import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreatePriceAdjustmentDto } from './dto/create-price-adjustment.dto';
import type { ReviewPriceAdjustmentDto } from './dto/review-price-adjustment.dto';

function prismaCode(error: unknown): string | undefined {
  return (error as { code?: string })?.code;
}

function containsContactInformation(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) ||
    /(?:\+?\d[\s().-]*){9,}/.test(normalized)
  );
}

@Injectable()
export class PriceAdjustmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRequest(userId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        OR: [
          { customerId: userId },
          { acceptedProviderProfile: { userId } },
        ],
      },
      select: {
        id: true,
        customerId: true,
        acceptedProviderProfile: { select: { userId: true } },
      },
    });
    if (!request) throw new NotFoundException('درخواست پیدا نشد');

    return this.prisma.serviceRequestPriceAdjustment.findMany({
      where: {
        serviceRequestId: requestId,
        ...(request.customerId === userId
          ? { status: { not: 'PENDING_SUPPORT_REVIEW' as const } }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        reason: true,
        items: true,
        previousTotalToman: true,
        newTotalToman: true,
        amountToman: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        respondedAt: true,
        paidAt: true,
      },
    });
  }

  async createForProvider(
    userId: string,
    requestId: string,
    input: CreatePriceAdjustmentDto,
  ) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) {
      throw new ForbiddenException('فقط متخصص می‌تواند درخواست اصلاح مبلغ بدهد');
    }

    const items = input.items.map((item) => {
      const description = item.description.trim();
      if (!description) {
        throw new BadRequestException('شرح هر هزینه‌ی اضافه الزامی است');
      }
      if (containsContactInformation(description)) {
        throw new BadRequestException(
          'ثبت شماره تماس یا ایمیل در شرح هزینه مجاز نیست',
        );
      }
      const amountToman = item.quantity * item.unitPriceToman;
      if (!Number.isSafeInteger(amountToman)) {
        throw new BadRequestException('مبلغ ردیف هزینه معتبر نیست');
      }
      return {
        description,
        quantity: item.quantity,
        unitPriceToman: item.unitPriceToman,
        amountToman,
      };
    });
    const amountToman = items.reduce((sum, item) => sum + item.amountToman, 0);
    if (!Number.isSafeInteger(amountToman) || amountToman <= 0) {
      throw new BadRequestException('مجموع هزینه‌ی اضافه باید بیشتر از صفر باشد');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const request = await tx.serviceRequest.findFirst({
        where: {
          id: requestId,
          acceptedProviderProfileId: provider.id,
        },
        select: {
          id: true,
          customerId: true,
          title: true,
          status: true,
          providerPriceToman: true,
        },
      });
      if (!request) throw new NotFoundException('درخواست تخصیص‌یافته پیدا نشد');
      if (request.status !== 'IN_PROGRESS') {
        throw new ConflictException(
          'درخواست اصلاح مبلغ فقط حین انجام کار قابل ثبت است',
        );
      }
      if (!request.providerPriceToman || request.providerPriceToman <= 0) {
        throw new ConflictException('مبلغ پایه‌ی درخواست معتبر نیست');
      }
      const activeAdjustment =
        await tx.serviceRequestPriceAdjustment.findFirst({
          where: {
            serviceRequestId: request.id,
            status: {
              in: ['PENDING_SUPPORT_REVIEW', 'PENDING', 'APPROVED'],
            },
          },
          select: { id: true },
        });
      if (activeAdjustment) {
        throw new ConflictException(
          'برای این درخواست یک اصلاح مبلغ در انتظار رسیدگی یا پرداخت است',
        );
      }

      const newTotalToman = request.providerPriceToman + amountToman;
      if (!Number.isSafeInteger(newTotalToman)) {
        throw new BadRequestException('مبلغ نهایی از محدوده‌ی مجاز بیشتر است');
      }
      const adjustment = await tx.serviceRequestPriceAdjustment.create({
        data: {
          serviceRequestId: request.id,
          proposedByUserId: userId,
          reason: input.reason.trim(),
          items,
          previousTotalToman: request.providerPriceToman,
          newTotalToman,
          amountToman,
          status: 'PENDING_SUPPORT_REVIEW',
        },
      });
      return adjustment;
    });
  }

  async listPendingForSupport() {
    return this.prisma.serviceRequestPriceAdjustment.findMany({
      where: { status: 'PENDING_SUPPORT_REVIEW' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        reason: true,
        items: true,
        previousTotalToman: true,
        newTotalToman: true,
        amountToman: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        serviceRequest: {
          select: {
            id: true,
            title: true,
            status: true,
            customer: { select: { id: true, name: true, phone: true } },
            acceptedProviderProfile: {
              select: { id: true, user: { select: { id: true, name: true, phone: true } } },
            },
          },
        },
      },
    });
  }

  async reviewBySupport(
    adminId: string,
    adjustmentId: string,
    input: ReviewPriceAdjustmentDto,
  ) {
    const note = input.note?.trim() || null;
    if (input.decision === 'REJECT' && (!note || note.length < 5)) {
      throw new BadRequestException('برای رد درخواست، دلیل را حداقل در ۵ نویسه وارد کنید');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "ServiceRequestPriceAdjustment" WHERE "id" = ${adjustmentId} FOR UPDATE
      `;
      const adjustment =
        await tx.serviceRequestPriceAdjustment.findUnique({
          where: { id: adjustmentId },
          select: {
            id: true,
            status: true,
            serviceRequestId: true,
            amountToman: true,
            serviceRequest: {
              select: {
                title: true,
                customerId: true,
                acceptedProviderProfile: { select: { userId: true } },
              },
            },
          },
        });
      if (!adjustment) {
        throw new NotFoundException('درخواست اصلاح مبلغ پیدا نشد');
      }
      if (adjustment.status !== 'PENDING_SUPPORT_REVIEW') {
        throw new ConflictException('این درخواست دیگر در انتظار بررسی پشتیبانی نیست');
      }

      const status = input.decision === 'APPROVE' ? 'PENDING' : 'REJECTED';
      const reviewedAt = new Date();
      const updated = await tx.serviceRequestPriceAdjustment.updateMany({
        where: { id: adjustment.id, status: 'PENDING_SUPPORT_REVIEW' },
        data: { status, reviewNote: note, reviewedAt, respondedAt: reviewedAt },
      });
      if (updated.count !== 1) {
        throw new ConflictException('درخواست هم‌زمان بررسی شده است');
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          action:
            input.decision === 'APPROVE'
              ? 'SERVICE_PRICE_ADJUSTMENT_APPROVED'
              : 'SERVICE_PRICE_ADJUSTMENT_REJECTED',
          targetType: 'SERVICE_REQUEST_PRICE_ADJUSTMENT',
          targetId: adjustment.id,
          reason: note ?? 'تأیید اصلاح مبلغ',
          beforeState: { status: adjustment.status },
          afterState: { status, reviewNote: note },
        },
      });

      const providerUserId =
        adjustment.serviceRequest.acceptedProviderProfile?.userId;
      const notifications =
        input.decision === 'APPROVE'
          ? [
              {
                userId: adjustment.serviceRequest.customerId,
                title: 'درخواست اصلاح مبلغ تأیید شد',
                body: `پشتیبانی درخواست افزایش مبلغ «${adjustment.serviceRequest.title}» را تأیید کرد؛ اکنون می‌توانید مابه‌التفاوت را بررسی و پرداخت کنید.`,
              },
              ...(providerUserId
                ? [
                    {
                      userId: providerUserId,
                      title: 'درخواست اصلاح مبلغ تأیید شد',
                      body: `پشتیبانی درخواست افزایش مبلغ «${adjustment.serviceRequest.title}» را تأیید کرد و برای تصمیم‌گیری به مشتری فرستاد.`,
                    },
                  ]
                : []),
            ]
          : providerUserId
            ? [
                {
                  userId: providerUserId,
                  title: 'درخواست اصلاح مبلغ تأیید نشد',
                  body: `پشتیبانی درخواست افزایش مبلغ «${adjustment.serviceRequest.title}» را رد کرد؛ مبلغ قبلی تغییری نکرد.${note ? ` دلیل: ${note}` : ''}`,
                },
              ]
            : [];
      for (const notification of notifications) {
        await tx.notification.create({
          data: {
            userId: notification.userId,
            category: 'PAYMENTS',
            type: 'PAYMENT_UPDATE',
            title: notification.title,
            body: notification.body,
            serviceRequestId: adjustment.serviceRequestId,
          },
        });
      }

      return { id: adjustment.id, status, reviewNote: note, reviewedAt };
    });
  }

  async rejectByCustomer(userId: string, adjustmentId: string) {
    const adjustment = await this.prisma.serviceRequestPriceAdjustment.findFirst({
      where: {
        id: adjustmentId,
        serviceRequest: { customerId: userId },
      },
      select: {
        id: true,
        status: true,
        serviceRequestId: true,
        serviceRequest: {
          select: {
            title: true,
            acceptedProviderProfile: { select: { userId: true } },
          },
        },
      },
    });
    if (!adjustment) throw new NotFoundException('درخواست اصلاح مبلغ پیدا نشد');
    if (adjustment.status !== 'PENDING') {
      throw new ConflictException('این درخواست اصلاح مبلغ دیگر قابل رد نیست');
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.serviceRequestPriceAdjustment.updateMany({
        where: { id: adjustment.id, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      if (!result.count) {
        throw new ConflictException('این درخواست هم‌زمان پاسخ داده شده است');
      }
      if (adjustment.serviceRequest.acceptedProviderProfile?.userId) {
        await tx.notification.create({
          data: {
            userId: adjustment.serviceRequest.acceptedProviderProfile.userId,
            category: 'PAYMENTS',
            type: 'PAYMENT_UPDATE',
            title: 'پیشنهاد افزایش مبلغ رد شد',
            body: `مشتری درخواست افزایش مبلغ «${adjustment.serviceRequest.title}» را نپذیرفت؛ مبلغ قبلی تغییر نکرد.`,
            serviceRequestId: adjustment.serviceRequestId,
          },
        });
      }
      return { id: adjustment.id, status: 'REJECTED' as const };
    });
  }

  async approveForCheckout(userId: string, adjustmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const adjustment =
        await tx.serviceRequestPriceAdjustment.findFirst({
          where: {
            id: adjustmentId,
            serviceRequest: { customerId: userId },
          },
          select: { id: true, status: true },
        });
      if (!adjustment) {
        throw new NotFoundException('درخواست اصلاح مبلغ پیدا نشد');
      }
      if (adjustment.status !== 'PENDING' && adjustment.status !== 'APPROVED') {
        throw new ConflictException(
          'این درخواست اصلاح مبلغ دیگر قابل پرداخت نیست',
        );
      }
      if (adjustment.status === 'PENDING') {
        const updated = await tx.serviceRequestPriceAdjustment.updateMany({
          where: { id: adjustmentId, status: 'PENDING' },
          data: { status: 'APPROVED', respondedAt: new Date() },
        });
        if (!updated.count) {
          throw new ConflictException(
            'این درخواست هم‌زمان توسط دیگری پاسخ داده شده است',
          );
        }
      }
      return { id: adjustmentId, status: 'APPROVED' as const };
    });
  }
}
