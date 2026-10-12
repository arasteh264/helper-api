import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import { AdminAuditQueryDto } from './admin-operations.dto';

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
}
