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
        include: {
          serviceRequest: {
            include: {
              specialty: {
                select: {
                  name: true,
                  pricingMode: true,
                  hourlyRateToman: true,
                  hourlyUnitLabel: true,
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
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.providerRequestInvitation.findMany({
        where: { providerProfileId: profile.id, status: 'DECLINED' },
        include: {
          serviceRequest: {
            include: {
              specialty: {
                select: {
                  name: true,
                  pricingMode: true,
                  hourlyRateToman: true,
                  hourlyUnitLabel: true,
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
        invitation,
      })),
      ...declinedInvitations.map((invitation) => ({
        request: invitation.serviceRequest,
        viewStatus: 'declined' as const,
        invitation,
      })),
      ...assigned.map((request) => ({
        request,
        viewStatus: this.toViewStatus(request.status),
        invitation: null,
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

    return records.map(({ request, viewStatus, invitation }) => {
      const customer = customerById.get(request.customerId);
      const canSeeAddress =
        viewStatus === 'accepted' ||
        viewStatus === 'in_progress' ||
        viewStatus === 'awaiting_confirmation';
      const paymentStatus = request.payments[0]?.status ?? 'PENDING';
      return {
        id: request.id,
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
          invitation?.proposedPriceToman ??
          request.providerPriceToman ??
          request.budgetMax ??
          request.budgetMin ??
          0,
        pricingMode:
          request.providerPricingMode ??
          request.specialty?.pricingMode ??
          'QUOTE',
        hourlyRateToman:
          request.providerHourlyRateToman ??
          request.specialty?.hourlyRateToman ??
          null,
        hourlyUnitLabel:
          request.providerHourlyUnitLabel ??
          request.specialty?.hourlyUnitLabel ??
          null,
        estimatedHours:
          invitation?.estimatedHours ?? request.providerEstimatedHours,
        quoteNote: invitation?.quoteNote ?? null,
        quoteSubmitted: invitation?.proposedPriceToman != null,
        status: viewStatus,
        note: request.description,
        images: request.images.map((image) => image.url),
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
    proposedPriceToman?: number,
    quoteNote?: string,
    estimatedHours?: number,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const normalizedQuoteNote = quoteNote?.trim();
    if (!normalizedQuoteNote) {
      throw new BadRequestException('توضیحات پیشنهاد قیمت را وارد کنید');
    }
    let quotedPriceToman = 0;
    let pricingMode: 'QUOTE' | 'HOURLY' = 'QUOTE';
    let hourlyRateToman: number | null = null;
    let hourlyUnitLabel: string | null = null;
    let quotedEstimatedHours: number | null = null;
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
        quotedEstimatedHours = estimatedHours;
        quotedPriceToman = Math.round(hourlyRateToman * estimatedHours);
      } else {
        if (!proposedPriceToman || proposedPriceToman <= 0) {
          throw new BadRequestException(
            'مبلغ پیشنهادی باید بزرگ‌تر از صفر باشد',
          );
        }
        quotedPriceToman = proposedPriceToman;
      }
      if (!Number.isSafeInteger(quotedPriceToman)) {
        throw new BadRequestException('مبلغ پیشنهادی معتبر نیست');
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

      await db.providerRequestInvitation.update({
        where: { id: invitation.id },
        data: {
          proposedPriceToman: quotedPriceToman,
          quoteNote: normalizedQuoteNote,
          estimatedHours: quotedEstimatedHours,
        },
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
      proposedPriceToman: quotedPriceToman,
      quoteNote: normalizedQuoteNote,
      pricingMode,
      hourlyRateToman,
      hourlyUnitLabel,
      estimatedHours: quotedEstimatedHours,
    };
  }

  async decline(userId: string, requestId: string) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.providerRequestInvitation.updateMany({
      where: {
        providerProfileId: profile.id,
        serviceRequestId: requestId,
        status: 'PENDING',
        serviceRequest: { status: 'OPEN' },
      },
      data: { status: 'DECLINED', respondedAt: new Date() },
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

  async complete(userId: string, requestId: string) {
    return this.transitionAssignedRequest(
      userId,
      requestId,
      'IN_PROGRESS',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'کار برای تأیید مشتری ارسال شد',
    );
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
