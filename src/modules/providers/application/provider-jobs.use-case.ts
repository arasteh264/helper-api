import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../../infrastructure/database/prisma.service.token';
import { NotificationsService } from '../../notifications/notifications.service';
import type { ProviderDeclineReason } from './dto/decline-service-request.dto';
import type { SubmitServiceRequestQuoteDto } from './dto/submit-service-request-quote.dto';
import { QuoteItemSupplyMode } from './dto/submit-service-request-quote.dto';
import type { CompleteServiceRequestDto } from './dto/complete-service-request.dto';
import type { RequestServiceCancellationDto } from './dto/request-service-cancellation.dto';

@Injectable()
export class ProviderJobsUseCase {
  private readonly logger = new Logger(ProviderJobsUseCase.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const profile = await this.getProfile(userId);

    const [invitations, assigned, declinedInvitations] = await Promise.all([
      this.prisma.providerRequestInvitation.findMany({
        where: {
          providerProfileId: profile.id,
          status: 'PENDING',
          serviceRequest: { status: 'OPEN' },
        },
        omit: {
          declineReason: true,
          declineNote: true,
        },
        include: {
          serviceRequest: {
            include: {
              specialty: {
                select: {
                  name: true,
                  pricingMode: true,
                  hourlyRateToman: true,
                  hourlyUnitLabel: true,
                  allowsQuoteItems: true,
                },
              },
              skills: { include: { skill: true } },
              images: { select: { url: true } },
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { status: true },
              },
              disputeMessages: {
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  body: true,
                  createdAt: true,
                  author: { select: { id: true, name: true, role: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceRequest.findMany({
        where: {
          acceptedProviderProfileId: profile.id,
          status: {
            in: [
              'CUSTOMER_CONFIRMATION_PENDING',
              'OFFER_ACCEPTED',
              'IN_PROGRESS',
              'AWAITING_CUSTOMER_CONFIRMATION',
              'COMPLETED',
              'CANCELLED',
              'EXPIRED',
              'DISPUTED',
            ],
          },
        },
        include: {
          specialty: {
            select: {
              name: true,
              pricingMode: true,
              hourlyRateToman: true,
              hourlyUnitLabel: true,
              allowsQuoteItems: true,
            },
          },
          skills: { include: { skill: true } },
          images: { select: { url: true } },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
          disputeMessages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { id: true, name: true, role: true } },
            },
          },
          workReport: true,
          providerCancellationRequests: {
            orderBy: { requestedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              reason: true,
              note: true,
              status: true,
              requestedAt: true,
              decisionNote: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.providerRequestInvitation.findMany({
        where: { providerProfileId: profile.id, status: 'DECLINED' },
        omit: {
          declineReason: true,
          declineNote: true,
        },
        include: {
          serviceRequest: {
            include: {
              specialty: {
                select: {
                  name: true,
                  pricingMode: true,
                  hourlyRateToman: true,
                  hourlyUnitLabel: true,
                  allowsQuoteItems: true,
                },
              },
              skills: { include: { skill: true } },
              images: { select: { url: true } },
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { status: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const records = [
      ...invitations.map((invitation) => ({
        request: invitation.serviceRequest,
        viewStatus: 'new' as const,
      })),
      ...declinedInvitations.map((invitation) => ({
        request: invitation.serviceRequest,
        viewStatus: 'declined' as const,
      })),
      ...assigned.map((request) => ({
        request,
        viewStatus: this.toViewStatus(request.status),
      })),
    ];
    const customerIds = [
      ...new Set(records.map(({ request }) => request.customerId)),
    ];
    const customers = customerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );
    const quotes = records.length
      ? await this.prisma.serviceRequestQuote.findMany({
          where: {
            providerProfileId: profile.id,
            serviceRequestId: { in: records.map(({ request }) => request.id) },
          },
        })
      : [];
    const quoteByRequestId = new Map(
      quotes.map((quote) => [quote.serviceRequestId, quote]),
    );

    return records.map(({ request, viewStatus, ...record }) => {
      const customer = customerById.get(request.customerId);
      const declineReason =
        'declineReason' in record ? record.declineReason : null;
      const declineNote = 'declineNote' in record ? record.declineNote : null;
      const canSeeAddress =
        viewStatus === 'accepted' ||
        viewStatus === 'in_progress' ||
        viewStatus === 'awaiting_confirmation';
      const paymentStatus = request.payments[0]?.status ?? 'PENDING';
      const quote = quoteByRequestId.get(request.id);
      const cancellationRequest =
        'providerCancellationRequests' in request
          ? request.providerCancellationRequests[0]
          : undefined;
      return {
        id: request.id,
        createdAt: request.createdAt.toISOString(),
        title: request.title,
        service:
          request.specialty?.name ??
          (request.skills.map((item) => item.skill.name).join('، ') || 'عمومی'),
        customerName: customer?.name ?? 'مشتری',
        customerPhone: paymentStatus === 'PAID' ? customer?.phone : undefined,
        paymentStatus,
        address: canSeeAddress
          ? (request.address ?? 'آدرس ثبت نشده است')
          : 'آدرس پس از پرداخت نمایش داده می‌شود',
        scheduledAt: (request.scheduledAt ?? request.createdAt).toISOString(),
        price:
          request.providerPriceToman ??
          request.budgetMax ??
          request.budgetMin ??
          0,
        pricingMode:
          request.providerPricingMode ?? request.specialty?.pricingMode ?? 'QUOTE',
        hourlyRateToman:
          request.providerHourlyRateToman ??
          request.specialty?.hourlyRateToman ??
          null,
        hourlyUnitLabel:
          request.providerHourlyUnitLabel ??
          request.specialty?.hourlyUnitLabel ??
          null,
        estimatedHours: request.providerEstimatedHours,
        allowsQuoteItems: request.specialty?.allowsQuoteItems ?? false,
        quoteSubmitted: Boolean(quote),
        proposedPriceToman: quote?.laborPriceToman ?? undefined,
        quoteTotalPriceToman: quote?.totalPriceToman ?? undefined,
        quoteNote: quote?.quoteNote ?? undefined,
        quoteItems: quote?.items ?? [],
        status: viewStatus,
        ...(cancellationRequest ? { cancellationRequest } : {}),
        ...(viewStatus === 'declined'
          ? {
              declineReason,
              declineNote,
            }
          : {}),
        note: request.description,
        images: request.images.map((image) => image.url),
        workReport:
          'workReport' in request && request.workReport
            ? {
                ...request.workReport,
                materials: Array.isArray(request.workReport.materials)
                  ? request.workReport.materials
                  : [],
              }
            : null,
        ...(request.disputeReason
          ? {
              disputeReason: request.disputeReason,
              disputeDescription: request.disputeDescription,
              disputeResolved: Boolean(request.disputeResolvedAt),
              disputeResolution: request.disputeResolution,
              disputeResolutionNote: request.disputeResolutionNote,
              disputeMessages: ('disputeMessages' in request
                ? request.disputeMessages
                : []
              ).map((message) => ({
                id: message.id,
                body: message.body,
                createdAt: message.createdAt.toISOString(),
                authorName: message.author.name,
                authorRole: message.author.role,
              })),
            }
          : {}),
      };
    });
  }

  async submitQuote(
    userId: string,
    requestId: string,
    dto: SubmitServiceRequestQuoteDto,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        status: 'OPEN',
        acceptedProviderProfileId: null,
      },
      select: {
        id: true,
        customerId: true,
        title: true,
        specialty: {
          select: {
            pricingMode: true,
            hourlyRateToman: true,
            hourlyUnitLabel: true,
            allowsQuoteItems: true,
          },
        },
        invitations: {
          where: { providerProfileId: profile.id, status: 'PENDING' },
          select: { id: true },
        },
      },
    });
    if (!request || !request.invitations.length) {
      throw new NotFoundException('دعوت همکاری در دسترس نیست');
    }

    const items = dto.items ?? [];
    if (items.length > 0 && !request.specialty?.allowsQuoteItems) {
      throw new ForbiddenException('ثبت هزینه‌ی قطعات برای این تخصص فعال نیست');
    }
    for (const item of items) {
      if (item.supplyMode === QuoteItemSupplyMode.CUSTOMER && item.amountToman !== 0) {
        throw new BadRequestException('برای اقلامی که مشتری تهیه می‌کند مبلغ وارد نکنید');
      }
      if (
        item.supplyMode === QuoteItemSupplyMode.PROVIDER_SEPARATE &&
        item.amountToman <= 0
      ) {
        throw new BadRequestException('هزینه‌ی اقلام جداگانه باید بیشتر از صفر باشد');
      }
    }

    const pricingMode = request.specialty?.pricingMode ?? 'QUOTE';
    const estimatedHours = dto.estimatedHours ?? null;
    let laborPriceToman = dto.proposedPriceToman;
    let hourlyRateToman: number | null = null;
    let hourlyUnitLabel: string | null = null;
    if (pricingMode === 'HOURLY') {
      if (!estimatedHours || estimatedHours <= 0) {
        throw new BadRequestException('تعداد ساعت تخمینی الزامی است');
      }
      if (!request.specialty?.hourlyRateToman) {
        throw new ConflictException('نرخ ساعتی این تخصص تنظیم نشده است');
      }
      hourlyRateToman = request.specialty.hourlyRateToman;
      hourlyUnitLabel = request.specialty.hourlyUnitLabel;
      laborPriceToman = Math.round(hourlyRateToman * estimatedHours);
    } else if (estimatedHours !== null) {
      throw new BadRequestException('برای این تخصص تعداد ساعت ارسال نکنید');
    }
    if (!Number.isSafeInteger(laborPriceToman) || laborPriceToman <= 0) {
      throw new BadRequestException('مبلغ اجرت معتبر نیست');
    }
    const totalPriceToman =
      laborPriceToman +
      items.reduce(
        (sum, item) =>
          sum +
          (item.supplyMode === QuoteItemSupplyMode.PROVIDER_SEPARATE
            ? item.amountToman
            : 0),
        0,
      );
    if (!Number.isSafeInteger(totalPriceToman)) {
      throw new BadRequestException('مبلغ کل پیشنهاد معتبر نیست');
    }
    const quoteItems = items.map(({ name, amountToman, supplyMode }) => ({
      name,
      amountToman,
      supplyMode,
    }));

    const quote = await this.prisma.serviceRequestQuote.upsert({
      where: {
        serviceRequestId_providerProfileId: {
          serviceRequestId: request.id,
          providerProfileId: profile.id,
        },
      },
      create: {
        serviceRequestId: request.id,
        providerProfileId: profile.id,
        laborPriceToman,
        totalPriceToman,
        quoteNote: dto.quoteNote.trim(),
        estimatedHours,
        pricingMode,
        hourlyRateToman,
        hourlyUnitLabel,
        items: quoteItems,
      },
      update: {
        laborPriceToman,
        totalPriceToman,
        quoteNote: dto.quoteNote.trim(),
        estimatedHours,
        pricingMode,
        hourlyRateToman,
        hourlyUnitLabel,
        items: quoteItems,
      },
      select: { id: true },
    });
    await this.notifications.createForUser({
      userId: request.customerId,
      category: 'OPPORTUNITIES',
      type: 'PROVIDER_OFFER',
      title: 'پیشنهاد قیمت متخصص',
      body: `برای درخواست «${request.title}» پیشنهاد قیمت جدید ثبت شده است.`,
      serviceRequestId: requestId,
    });

    return { id: quote.id, laborPriceToman, totalPriceToman };
  }

  async accept(
    userId: string,
    requestId: string,
    proposedPriceToman?: number,
    estimatedHours?: number,
  ) {
    const profile = await this.getApprovedProfile(userId);
    let acceptedPriceToman = 0;
    let pricingMode: 'QUOTE' | 'HOURLY' = 'QUOTE';
    let hourlyRateToman: number | null = null;
    let hourlyUnitLabel: string | null = null;
    let acceptedEstimatedHours: number | null = null;
    let customerId = '';
    let requestTitle = '';
    await this.prisma.$transaction(async (db) => {
      const request = await db.serviceRequest.findFirst({
        where: {
          id: requestId,
          status: 'OPEN',
          acceptedProviderProfileId: null,
        },
        select: {
          id: true,
          customerId: true,
          title: true,
          specialty: {
            select: {
              pricingMode: true,
              hourlyRateToman: true,
              hourlyUnitLabel: true,
            },
          },
        },
      });
      if (!request) {
        throw new ConflictException('درخواست دیگر برای پذیرش در دسترس نیست');
      }
      customerId = request.customerId;
      requestTitle = request.title;

      pricingMode = request.specialty?.pricingMode ?? 'QUOTE';
      if (pricingMode === 'HOURLY') {
        if (!estimatedHours || estimatedHours <= 0) {
          throw new BadRequestException('تعداد ساعت تخمینی الزامی است');
        }
        if (!request.specialty?.hourlyRateToman) {
          throw new ConflictException('نرخ ساعتی این تخصص تنظیم نشده است');
        }
        hourlyRateToman = request.specialty.hourlyRateToman;
        hourlyUnitLabel = request.specialty.hourlyUnitLabel;
        acceptedEstimatedHours = estimatedHours;
        acceptedPriceToman = Math.round(hourlyRateToman * estimatedHours);
      } else {
        if (!proposedPriceToman || proposedPriceToman <= 0) {
          throw new BadRequestException(
            'مبلغ پیشنهادی باید بزرگ‌تر از صفر باشد',
          );
        }
        acceptedPriceToman = proposedPriceToman;
      }
      if (!Number.isSafeInteger(acceptedPriceToman)) {
        throw new BadRequestException('مبلغ نهایی معتبر نیست');
      }

      const invitation = await db.providerRequestInvitation.findUnique({
        where: {
          providerProfileId_serviceRequestId: {
            providerProfileId: profile.id,
            serviceRequestId: requestId,
          },
        },
      });
      if (!invitation || invitation.status !== 'PENDING') {
        throw new NotFoundException('دعوت همکاری در دسترس نیست');
      }

      const result = await db.serviceRequest.updateMany({
        where: {
          id: requestId,
          status: 'OPEN',
          acceptedProviderProfileId: null,
        },
        data: {
          status: 'CUSTOMER_CONFIRMATION_PENDING',
          acceptedProviderProfileId: profile.id,
          providerPriceToman: acceptedPriceToman,
          providerLaborPriceToman: acceptedPriceToman,
          providerPricingMode: pricingMode,
          providerHourlyRateToman: hourlyRateToman,
          providerHourlyUnitLabel: hourlyUnitLabel,
          providerEstimatedHours: acceptedEstimatedHours,
        },
      });
      if (result.count === 0) {
        throw new ConflictException('درخواست به متخصص دیگری واگذار شده است');
      }

      await db.providerRequestInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await db.providerRequestInvitation.updateMany({
        where: {
          serviceRequestId: requestId,
          providerProfileId: { not: profile.id },
          status: 'PENDING',
        },
        data: { status: 'WITHDRAWN', respondedAt: new Date() },
      });
    });
    await this.notifications.createForUser({
      userId: customerId,
      category: 'OPPORTUNITIES',
      type: 'PROVIDER_OFFER',
      title: 'پیشنهاد قیمت متخصص',
      body: `برای درخواست «${requestTitle}» پیشنهاد قیمت جدید ثبت شده است.`,
      serviceRequestId: requestId,
    });
    return {
      message: 'پیشنهاد قیمت برای مشتری ارسال شد',
      proposedPriceToman: acceptedPriceToman,
      pricingMode,
      hourlyRateToman,
      hourlyUnitLabel,
      estimatedHours: acceptedEstimatedHours,
    };
  }

  async decline(
    userId: string,
    requestId: string,
    reason: ProviderDeclineReason,
    note?: string,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.providerRequestInvitation.updateMany({
      where: {
        providerProfileId: profile.id,
        serviceRequestId: requestId,
        status: 'PENDING',
        serviceRequest: { status: 'OPEN' },
      },
      data: {
        status: 'DECLINED',
        respondedAt: new Date(),
        declineReason: reason,
        declineNote: reason === 'OTHER' ? note?.trim() : null,
      },
    });
    if (!result.count) throw new NotFoundException('دعوت همکاری در دسترس نیست');
    return { message: 'درخواست رد شد' };
  }

  async start(userId: string, requestId: string) {
    return this.transitionAssignedRequest(
      userId,
      requestId,
      'OFFER_ACCEPTED',
      'IN_PROGRESS',
      'کار شروع شد',
    );
  }

  async requestCancellation(
    userId: string,
    requestId: string,
    input: RequestServiceCancellationDto,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const note = input.note?.trim() || null;
    const cancellation = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const request = await tx.serviceRequest.findFirst({
        where: {
          id: requestId,
          acceptedProviderProfileId: profile.id,
          status: { in: ['OFFER_ACCEPTED', 'IN_PROGRESS'] },
          payments: { some: { status: 'PAID' } },
          providerCancellationRequests: { none: { status: 'PENDING' } },
        },
        select: { id: true, customerId: true, title: true },
      });
      if (!request) {
        throw new ConflictException(
          'این کار در وضعیت قابل لغو نیست یا درخواست لغوِ در انتظار بررسی دارد',
        );
      }
      const created = await tx.serviceRequestProviderCancellation.create({
        data: {
          serviceRequestId: request.id,
          providerProfileId: profile.id,
          reason: input.reason,
          note,
        },
        select: {
          id: true,
          reason: true,
          note: true,
          status: true,
          requestedAt: true,
        },
      });
      return { request, cancellation: created };
    });

    await this.notifications.createForUser({
      userId: cancellation.request.customerId,
      category: 'WORK_UPDATES',
      type: 'SERVICE_REQUEST_STATUS',
      title: 'درخواست لغو کار برای بررسی ارسال شد',
      body: `متخصص برای درخواست «${cancellation.request.title}» درخواست لغو ثبت کرده است. نتیجه پس از بررسی پشتیبانی اطلاع داده می‌شود.`,
      serviceRequestId: requestId,
    });
    return {
      message: 'درخواست لغو برای بررسی پشتیبانی ارسال شد',
      cancellationRequest: cancellation.cancellation,
    };
  }

  async complete(
    userId: string,
    requestId: string,
    input: CompleteServiceRequestDto,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const summary = input.summary.trim();
    const materials = (input.materials ?? [])
      .map((material) => material.trim())
      .filter(Boolean);
    if (summary.length < 10) {
      throw new BadRequestException('شرح کار را حداقل در ۱۰ نویسه بنویسید');
    }
    if (materials.length > 50 || materials.some((material) => material.length > 200)) {
      throw new BadRequestException('فهرست قطعات و اقلام مصرفی معتبر نیست');
    }

    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        acceptedProviderProfileId: profile.id,
        status: 'IN_PROGRESS',
        payments: { some: { status: 'PAID' } },
      },
      select: { id: true, customerId: true, title: true },
    });
    if (!request) {
      throw new ConflictException('این کار در وضعیت قابل ثبت گزارش نیست');
    }

    const completedAt = new Date();
    const warrantyDays = input.warrantyDays ?? null;
    const warrantyExpiresAt =
      warrantyDays && warrantyDays > 0
        ? new Date(completedAt.getTime() + warrantyDays * 24 * 60 * 60 * 1000)
        : null;
    const report = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${request.id} FOR UPDATE`;
      const activeAdjustment =
        await tx.serviceRequestPriceAdjustment.findFirst({
          where: {
            serviceRequestId: request.id,
            status: { in: ['PENDING', 'APPROVED'] },
          },
          select: { id: true },
        });
      if (activeAdjustment) {
        throw new ConflictException(
          'تا زمان پاسخ مشتری و پرداخت اصلاح مبلغ، امکان ثبت پایان کار نیست',
        );
      }
      const pendingCancellation =
        await tx.serviceRequestProviderCancellation.findFirst({
          where: { serviceRequestId: request.id, status: 'PENDING' },
          select: { id: true },
        });
      if (pendingCancellation) {
        throw new ConflictException(
          'تا زمان بررسی درخواست لغو توسط پشتیبانی، امکان ثبت پایان کار نیست',
        );
      }
      const createdReport = await tx.serviceWorkReport.create({
        data: {
          serviceRequestId: request.id,
          providerProfileId: profile.id,
          summary,
          materials,
          warrantyDays,
          warrantyNote: input.warrantyNote?.trim() || null,
          completedAt,
          warrantyExpiresAt,
        },
      });
      const updated = await tx.serviceRequest.updateMany({
        where: {
          id: request.id,
          acceptedProviderProfileId: profile.id,
          status: 'IN_PROGRESS',
          payments: { some: { status: 'PAID' } },
          providerCancellationRequests: { none: { status: 'PENDING' } },
        },
        data: {
          status: 'AWAITING_CUSTOMER_CONFIRMATION',
          customerConfirmationDeadline: new Date(
            completedAt.getTime() + 72 * 60 * 60 * 1000,
          ),
        },
      });
      if (!updated.count) {
        throw new ConflictException('وضعیت این کار تغییر کرده است');
      }
      return createdReport;
    });

    await this.notifications.createForUser({
      userId: request.customerId,
      category: 'WORK_UPDATES',
      type: 'SERVICE_REQUEST_STATUS',
      title: 'گزارش پایان کار آماده است',
      body: `متخصص گزارش کار «${request.title}» را ثبت کرد. جزئیات و ضمانت را در پرونده‌ی درخواست ببینید.`,
      serviceRequestId: request.id,
    });
    return { message: 'گزارش کار برای تأیید مشتری ارسال شد', report };
  }

  private async transitionAssignedRequest(
    userId: string,
    requestId: string,
    currentStatus: 'OFFER_ACCEPTED' | 'IN_PROGRESS',
    nextStatus: 'IN_PROGRESS' | 'AWAITING_CUSTOMER_CONFIRMATION',
    message: string,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        acceptedProviderProfileId: profile.id,
        status: currentStatus,
        payments: { some: { status: 'PAID' } },
        providerCancellationRequests: { none: { status: 'PENDING' } },
      },
      data: {
        status: nextStatus,
        ...(nextStatus === 'AWAITING_CUSTOMER_CONFIRMATION' && {
          customerConfirmationDeadline: new Date(
            Date.now() + 72 * 60 * 60 * 1000,
          ),
        }),
      },
    });
    if (!result.count)
      throw new ConflictException('وضعیت این کار تغییر کرده است');
    const request = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { customerId: true, title: true },
    });
    await this.notifications.createForUser({
      userId: request.customerId,
      category: 'WORK_UPDATES',
      type: 'SERVICE_REQUEST_STATUS',
      title: 'وضعیت درخواست به‌روز شد',
      body:
        nextStatus === 'IN_PROGRESS'
          ? `کار «${request.title}» شروع شد.`
          : `متخصص کار «${request.title}» را برای تأیید شما تکمیل کرد.`,
      serviceRequestId: requestId,
    });
    return { message };
  }

  async addDisputeMessage(userId: string, requestId: string, body: string) {
    const profile = await this.getProfile(userId);
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        acceptedProviderProfileId: profile.id,
        status: 'DISPUTED',
      },
      select: { id: true, title: true, customerId: true },
    });
    if (!request) {
      throw new NotFoundException('اختلاف فعالی برای این درخواست پیدا نشد');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceRequestDisputeMessage.create({
        data: {
          serviceRequestId: request.id,
          authorUserId: userId,
          body: body.trim(),
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, role: true } },
        },
      });
      await tx.serviceRequest.update({
        where: { id: request.id },
        data: { disputeUpdatedAt: created.createdAt },
      });
      return created;
    });

    try {
      await this.notifications.createForUser({
        userId: request.customerId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: 'متخصص درباره‌ی اختلاف پیام فرستاد',
        body: `پیام جدیدی درباره‌ی درخواست «${request.title}» ثبت شد.`,
        serviceRequestId: request.id,
      });
    } catch (error) {
      this.logger.error(
        `Dispute reply notification failed for request ${request.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return message;
  }

  async raiseNonPaymentDispute(userId: string, requestId: string, description: string) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        acceptedProviderProfileId: profile.id,
        status: 'CUSTOMER_CONFIRMATION_PENDING',
        payments: { none: { status: 'PAID' } },
      },
      data: {
        status: 'DISPUTED',
        customerConfirmationDeadline: null,
        disputeReason: 'CUSTOMER_NON_PAYMENT',
        disputeDescription: description.trim(),
        disputeUpdatedAt: new Date(),
      },
    });
    if (!result.count) {
      throw new ConflictException(
        'درخواست در وضعیت انتظار پرداخت برای این متخصص نیست',
      );
    }
    const request = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: { title: true, customerId: true },
    });
    try {
      await this.notifications.createForUser({
        userId: request.customerId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: 'متخصص درباره‌ی پرداخت اختلاف ثبت کرد',
        body: `متخصص درباره‌ی پرداخت درخواست «${request.title}» اختلاف ثبت کرده است.`,
        serviceRequestId: requestId,
      });
    } catch (error) {
      this.logger.error(
        `Non-payment dispute notification failed for request ${requestId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return { message: 'اختلاف پرداخت برای بررسی ثبت شد' };
  }

  private async getApprovedProfile(userId: string) {
    const profile = await this.getProfile(userId);
    if (profile.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException('پس از تأیید حساب می‌توانید درخواست بگیرید');
    }
    return profile;
  }

  private async getProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        isAvailable: true,
        skills: { select: { skillId: true } },
      },
    });
    if (!profile) throw new NotFoundException('پروفایل متخصص پیدا نشد');
    return profile;
  }

  private toViewStatus(
    status: string,
  ):
    | 'awaiting_payment'
    | 'accepted'
    | 'in_progress'
    | 'awaiting_confirmation'
    | 'disputed'
    | 'completed'
    | 'cancelled' {
    switch (status) {
      case 'CUSTOMER_CONFIRMATION_PENDING':
        return 'awaiting_payment';
      case 'OFFER_ACCEPTED':
        return 'accepted';
      case 'IN_PROGRESS':
        return 'in_progress';
      case 'AWAITING_CUSTOMER_CONFIRMATION':
        return 'awaiting_confirmation';
      case 'DISPUTED':
        return 'disputed';
      case 'COMPLETED':
        return 'completed';
      default:
        return 'cancelled';
    }
  }
}
