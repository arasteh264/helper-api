import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  AdminAuditQueryDto,
  AdminExportQueryDto,
} from './admin-operations.dto';

const EXPORT_LIMIT = 10_000;

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csvDocument(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

@ApiTags('Admin - Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminOperationsController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'List recent auditable administrator actions' })
  @Get('audit-logs')
  async listAuditLogs(@Query() query: AdminAuditQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.targetType ? { targetType: query.targetType } : {};
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        include: { actor: { select: { name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  @ApiOperation({
    summary: 'Get operational queues that need administrator attention',
  })
  @Get('operations/alerts')
  async getOperationalAlerts() {
    const now = new Date();
    const oldPaymentCutoff = new Date(now.getTime() - 15 * 60_000);
    const unassignedRequestCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
    const oldDisputeCutoff = new Date(now.getTime() - 48 * 60 * 60_000);
    const [
      pendingProviders,
      pendingPayouts,
      stalePayments,
      unassignedRequests,
      staleDisputes,
    ] = await Promise.all([
      this.prisma.providerProfile.count({
        where: { verificationStatus: 'PENDING' },
      }),
      this.prisma.payoutRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({
        where: { status: 'PENDING', createdAt: { lte: oldPaymentCutoff } },
      }),
      this.prisma.serviceRequest.count({
        where: {
          status: 'OPEN',
          acceptedProviderProfileId: null,
          createdAt: { lte: unassignedRequestCutoff },
        },
      }),
      this.prisma.serviceRequest.count({
        where: {
          status: 'DISPUTED',
          disputeUpdatedAt: { lte: oldDisputeCutoff },
        },
      }),
    ]);
    return {
      generatedAt: now,
      items: [
        {
          key: 'pending-providers',
          label: 'ثبت‌نام متخصصان در انتظار بررسی',
          count: pendingProviders,
          href: '/dashboard/pending-providers',
          severity: 'medium',
        },
        {
          key: 'pending-payouts',
          label: 'درخواست برداشت در انتظار اقدام',
          count: pendingPayouts,
          href: '/dashboard/accounting/payouts',
          severity: 'high',
        },
        {
          key: 'stale-payments',
          label: 'پرداخت‌های معطل بیش از ۱۵ دقیقه',
          count: stalePayments,
          href: '/dashboard/accounting/payments',
          severity: 'high',
        },
        {
          key: 'unassigned-requests',
          label: 'درخواست‌های بازِ بی‌متخصص بیش از ۲۴ ساعت',
          count: unassignedRequests,
          href: '/dashboard/services',
          severity: 'medium',
        },
        {
          key: 'stale-disputes',
          label: 'اختلاف‌های بدون به‌روزرسانی بیش از ۴۸ ساعت',
          count: staleDisputes,
          href: '/dashboard/services',
          severity: 'high',
        },
      ],
    };
  }

  @ApiOperation({
    summary: 'List payment and payout records that need manual reconciliation',
  })
  @Get('operations/reconciliation')
  async getReconciliationIssues() {
    const now = new Date();
    const stalePaymentCutoff = new Date(now.getTime() - 60 * 60_000);
    const stalePayoutCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
    const [
      stalePayments,
      paidWithoutReference,
      stalePayouts,
      paidPayoutsWithoutReference,
    ] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          status: 'PENDING',
          gateway: 'ZARINPAL',
          createdAt: { lte: stalePaymentCutoff },
        },
        take: 100,
        orderBy: { createdAt: 'asc' },
        include: { serviceRequest: { select: { title: true } } },
      }),
      this.prisma.payment.findMany({
        where: {
          status: 'PAID',
          gateway: 'ZARINPAL',
          OR: [{ referenceId: null }, { referenceId: '' }],
        },
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: { serviceRequest: { select: { title: true } } },
      }),
      this.prisma.payoutRequest.findMany({
        where: { status: 'PENDING', createdAt: { lte: stalePayoutCutoff } },
        take: 100,
        orderBy: { createdAt: 'asc' },
        include: {
          wallet: {
            include: {
              providerProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
      }),
      this.prisma.payoutRequest.findMany({
        where: {
          status: 'PAID',
          OR: [{ referenceCode: null }, { referenceCode: '' }],
        },
        take: 100,
        orderBy: { processedAt: 'desc' },
        include: {
          wallet: {
            include: {
              providerProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
      }),
    ]);

    const items = [
      ...stalePayments.map((payment) => ({
        key: `payment-pending-${payment.id}`,
        category: 'پرداخت معطل',
        title: payment.serviceRequest.title,
        amountToman: payment.amountToman,
        status: payment.status,
        createdAt: payment.createdAt,
        explanation:
          'بیش از یک ساعت در انتظار تأیید درگاه است؛ وضعیت درگاه و تلاش‌های بررسی را تطبیق دهید.',
      })),
      ...paidWithoutReference.map((payment) => ({
        key: `payment-reference-${payment.id}`,
        category: 'پرداخت بدون کد پیگیری',
        title: payment.serviceRequest.title,
        amountToman: payment.amountToman,
        status: payment.status,
        createdAt: payment.createdAt,
        explanation:
          'پرداخت زرین‌پال موفق ثبت شده اما کد پیگیری در داده موجود نیست.',
      })),
      ...stalePayouts.map((payout) => ({
        key: `payout-pending-${payout.id}`,
        category: 'برداشت معطل',
        title: payout.wallet.providerProfile.user.name,
        amountToman: payout.amount,
        status: payout.status,
        createdAt: payout.createdAt,
        explanation: 'بیش از ۲۴ ساعت در انتظار بررسی است.',
      })),
      ...paidPayoutsWithoutReference.map((payout) => ({
        key: `payout-reference-${payout.id}`,
        category: 'برداشت بدون کد پیگیری',
        title: payout.wallet.providerProfile.user.name,
        amountToman: payout.amount,
        status: payout.status,
        createdAt: payout.processedAt ?? payout.createdAt,
        explanation: 'وضعیت پرداخت‌شده دارد اما کد پیگیری بانکی ثبت نشده است.',
      })),
    ];
    return {
      generatedAt: now,
      truncated: items.length >= 400,
      items,
    };
  }

  @ApiOperation({
    summary: 'Export an administrator dataset as formula-safe CSV',
  })
  @Get('exports')
  async exportCsv(
    @Query() query: AdminExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const take = EXPORT_LIMIT + 1;
    let headers: string[];
    let rows: unknown[][];
    switch (query.type) {
      case 'users': {
        const users = await this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
          },
        });
        headers = ['نام', 'ایمیل', 'تلفن', 'نقش', 'وضعیت', 'تاریخ عضویت'];
        rows = users.map((user) => [
          user.name,
          user.email,
          user.phone,
          user.role,
          user.status,
          user.createdAt.toISOString(),
        ]);
        break;
      }
      case 'providers': {
        const providers = await this.prisma.providerProfile.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          include: {
            user: {
              select: { name: true, email: true, phone: true, status: true },
            },
            skills: { include: { skill: { select: { name: true } } } },
          },
        });
        headers = [
          'نام',
          'ایمیل',
          'تلفن',
          'وضعیت حساب',
          'وضعیت بررسی',
          'فعالیت',
          'امتیاز',
          'مهارت‌ها',
          'تاریخ ثبت',
        ];
        rows = providers.map((provider) => [
          provider.user.name,
          provider.user.email,
          provider.user.phone,
          provider.user.status,
          provider.verificationStatus,
          provider.isAvailable ? 'آماده به کار' : 'غیرفعال',
          provider.rating,
          provider.skills.map(({ skill }) => skill.name).join('، '),
          provider.createdAt.toISOString(),
        ]);
        break;
      }
      case 'service-requests': {
        const requests = await this.prisma.serviceRequest.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          include: {
            customer: { select: { name: true, phone: true } },
            specialty: { select: { name: true } },
            acceptedProviderProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        });
        headers = [
          'عنوان',
          'وضعیت',
          'مشتری',
          'تلفن مشتری',
          'متخصص',
          'تخصص',
          'حداقل بودجه',
          'حداکثر بودجه',
          'ثبت',
        ];
        rows = requests.map((request) => [
          request.title,
          request.status,
          request.customer.name,
          request.customer.phone,
          request.acceptedProviderProfile?.user.name,
          request.specialty?.name,
          request.budgetMin,
          request.budgetMax,
          request.createdAt.toISOString(),
        ]);
        break;
      }
      case 'payments': {
        const payments = await this.prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          include: {
            serviceRequest: {
              include: {
                customer: { select: { name: true } },
                acceptedProviderProfile: {
                  include: { user: { select: { name: true } } },
                },
              },
            },
          },
        });
        headers = [
          'عنوان درخواست',
          'مشتری',
          'متخصص',
          'درگاه',
          'وضعیت',
          'مبلغ تومان',
          'کد پیگیری',
          'زمان پرداخت',
          'ثبت',
        ];
        rows = payments.map((payment) => [
          payment.serviceRequest.title,
          payment.serviceRequest.customer.name,
          payment.serviceRequest.acceptedProviderProfile?.user.name,
          payment.gateway,
          payment.status,
          payment.amountToman,
          payment.referenceId,
          payment.paidAt?.toISOString(),
          payment.createdAt.toISOString(),
        ]);
        break;
      }
      case 'payouts': {
        const payouts = await this.prisma.payoutRequest.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          include: {
            wallet: {
              include: {
                providerProfile: {
                  include: { user: { select: { name: true } } },
                },
              },
            },
          },
        });
        headers = [
          'متخصص',
          'وضعیت',
          'مبلغ تومان',
          'کد پیگیری',
          'دلیل رد',
          'ثبت',
          'پردازش',
        ];
        rows = payouts.map((payout) => [
          payout.wallet.providerProfile.user.name,
          payout.status,
          payout.amount,
          payout.referenceCode,
          payout.rejectReason,
          payout.createdAt.toISOString(),
          payout.processedAt?.toISOString(),
        ]);
        break;
      }
    }

    const truncated = rows.length > EXPORT_LIMIT;
    if (truncated) rows = rows.slice(0, EXPORT_LIMIT);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${query.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    response.setHeader('X-Export-Truncated', String(truncated));
    return `\uFEFF${csvDocument(headers, rows)}`;
  }
}
