import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import { NotificationsService } from '../notifications/notifications.service';

type ZarinpalReply = {
  data?: {
    code?: number;
    authority?: string;
    ref_id?: number | string;
    message?: string;
  };
  errors?: unknown;
};

type CheckoutReservation =
  | { paymentId: string; amountToman: number; requestId: string }
  | { existingAuthority: string; requestId: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getCustomerWallet(userId: string) {
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    const wallet = await this.prisma.customerWallet.upsert({
      where: { customerProfileId: profile.id },
      update: {},
      create: { customerProfileId: profile.id },
      select: { id: true, balance: true, totalSpent: true },
    });
    const topups = await this.prisma.customerWalletTopup.findMany({
      where: { customerWalletId: wallet.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        amountToman: true,
        status: true,
        referenceId: true,
        failureReason: true,
        createdAt: true,
        paidAt: true,
      },
    });

    return {
      balance: wallet.balance,
      totalSpent: wallet.totalSpent,
      transactions: topups.map((topup) => ({
        id: topup.id,
        type: 'topup' as const,
        date: topup.createdAt,
        description:
          topup.status === 'PAID'
            ? `شارژ کیف پول${topup.referenceId ? ` · کد پیگیری ${topup.referenceId}` : ''}`
            : topup.status === 'FAILED'
              ? 'شارژ ناموفق کیف پول'
              : 'شارژ کیف پول در انتظار پرداخت',
        amount: topup.amountToman,
        status:
          topup.status === 'PAID'
            ? ('completed' as const)
            : topup.status === 'FAILED' || topup.status === 'REFUNDED'
              ? ('failed' as const)
              : ('pending' as const),
        referenceId: topup.referenceId,
        failureReason: topup.failureReason,
        paidAt: topup.paidAt,
      })),
    };
  }

  async createCustomerWalletTopup(userId: string, amountToman: number) {
    if (!Number.isSafeInteger(amountToman) || amountToman < 10_000) {
      throw new BadRequestException('مبلغ شارژ باید حداقل ۱۰٬۰۰۰ تومان باشد');
    }
    const amountRial = amountToman * 10;
    if (!Number.isSafeInteger(amountRial)) {
      throw new BadRequestException('مبلغ شارژ معتبر نیست');
    }

    const config = this.getConfig();
    const profile = await this.prisma.customerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      select: { id: true },
    });
    const wallet = await this.prisma.customerWallet.upsert({
      where: { customerProfileId: profile.id },
      update: {},
      create: { customerProfileId: profile.id },
      select: { id: true },
    });
    const topup = await this.prisma.customerWalletTopup.create({
      data: { customerWalletId: wallet.id, amountToman },
      select: { id: true },
    });

    try {
      const reply = await this.post<ZarinpalReply>(
        this.getApiUrl(config.sandbox, 'request'),
        {
          merchant_id: config.merchantId,
          amount: amountRial,
          callback_url: config.callbackUrl,
          description: 'شارژ کیف پول مشتری',
        },
      );
      const authority = reply.data?.authority;
      if (reply.data?.code !== 100 || !authority) {
        await this.markCustomerWalletTopupFailed(
          topup.id,
          reply.data?.message ?? `Zarinpal code ${reply.data?.code}`,
        );
        throw new BadGatewayException('درگاه پرداخت درخواست شارژ را نپذیرفت');
      }

      await this.prisma.customerWalletTopup.update({
        where: { id: topup.id },
        data: { authority },
      });
      return {
        topupId: topup.id,
        paymentUrl: this.getStartPayUrl(config.sandbox, authority),
      };
    } catch (error) {
      if (!(error instanceof BadGatewayException)) {
        await this.markCustomerWalletTopupFailed(
          topup.id,
          error instanceof Error ? error.message : 'Zarinpal request failed',
        );
        throw new BadGatewayException('ارتباط با درگاه پرداخت برقرار نشد');
      }
      throw error;
    }
  }

  async createCheckout(userId: string, requestId: string) {
    const config = this.getConfig();
    const reservation = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;

      const request = await tx.serviceRequest.findFirst({
        where: { id: requestId, customerId: userId },
        select: {
          id: true,
          status: true,
          providerPriceToman: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, authority: true },
          },
        },
      });
      if (!request) throw new NotFoundException('درخواست پیدا نشد');
      if (request.status !== 'CUSTOMER_CONFIRMATION_PENDING') {
        throw new ConflictException('این درخواست هنوز آماده‌ی پرداخت نیست');
      }
      if (!request.providerPriceToman || request.providerPriceToman <= 0) {
        throw new ConflictException('قیمت نهایی provider ثبت نشده است');
      }

      const latestPayment = request.payments[0];
      if (latestPayment?.status === 'PAID') {
        throw new ConflictException('این درخواست قبلاً پرداخت شده است');
      }
      if (latestPayment?.status === 'PENDING') {
        if (latestPayment.authority) {
          return {
            existingAuthority: latestPayment.authority,
            requestId: request.id,
          } satisfies CheckoutReservation;
        }
        throw new ConflictException(
          'درخواست پرداخت دیگری در حال آماده‌سازی است',
        );
      }

      const payment = await tx.payment.create({
        data: {
          serviceRequestId: request.id,
          amountToman: request.providerPriceToman,
        },
        select: { id: true },
      });

      return {
        paymentId: payment.id,
        amountToman: request.providerPriceToman,
        requestId: request.id,
      } satisfies CheckoutReservation;
    });

    if (
      'existingAuthority' in reservation &&
      typeof reservation.existingAuthority === 'string'
    ) {
      return {
        paymentUrl: this.getStartPayUrl(
          config.sandbox,
          reservation.existingAuthority,
        ),
        requestId: reservation.requestId,
      };
    }

    const amountRial = reservation.amountToman * 10;
    if (!Number.isSafeInteger(amountRial)) {
      await this.markFailed(reservation.paymentId, 'مبلغ پرداخت معتبر نیست');
      throw new BadGatewayException('مبلغ پرداخت معتبر نیست');
    }

    try {
      const reply = await this.post<ZarinpalReply>(
        this.getApiUrl(config.sandbox, 'request'),
        {
          merchant_id: config.merchantId,
          amount: amountRial,
          callback_url: config.callbackUrl,
          description: `پرداخت درخواست ${reservation.requestId}`,
        },
      );
      const authority = reply.data?.authority;
      if (reply.data?.code !== 100 || !authority) {
        const reason =
          reply.data?.message ?? `Zarinpal code ${reply.data?.code}`;
        await this.markFailed(reservation.paymentId, reason);
        throw new BadGatewayException('درگاه پرداخت درخواست را نپذیرفت');
      }

      await this.prisma.payment.update({
        where: { id: reservation.paymentId },
        data: { authority },
      });
      return {
        paymentUrl: this.getStartPayUrl(config.sandbox, authority),
        requestId: reservation.requestId,
      };
    } catch (error) {
      if (!(error instanceof BadGatewayException)) {
        await this.markFailed(
          reservation.paymentId,
          error instanceof Error ? error.message : 'Zarinpal request failed',
        );
        throw new BadGatewayException('ارتباط با درگاه پرداخت برقرار نشد');
      }
      throw error;
    }
  }

  async handleCallback(
    authority: string | undefined,
    status: string | undefined,
  ) {
    const config = this.getConfig();
    if (!authority) return this.getReturnUrl(config.returnUrl, 'failed');

    const payment = await this.prisma.payment.findUnique({
      where: { authority },
      select: {
        id: true,
        amountToman: true,
        status: true,
        serviceRequestId: true,
        serviceRequest: {
          select: {
            title: true,
            customerId: true,
            acceptedProviderProfile: { select: { userId: true } },
          },
        },
      },
    });
    if (!payment) {
      return this.handleCustomerWalletTopupCallback(authority, status, config);
    }
    if (payment.status === 'PAID') {
      return this.getReturnUrl(
        config.returnUrl,
        'success',
        payment.serviceRequestId,
      );
    }
    if (payment.status !== 'PENDING' || status?.toUpperCase() !== 'OK') {
      await this.markFailed(payment.id, 'پرداخت توسط کاربر لغو شد');
      return this.getReturnUrl(
        config.returnUrl,
        'failed',
        payment.serviceRequestId,
      );
    }

    let reply: ZarinpalReply;
    try {
      reply = await this.post<ZarinpalReply>(
        this.getApiUrl(config.sandbox, 'verify'),
        {
          merchant_id: config.merchantId,
          amount: payment.amountToman * 10,
          authority,
        },
      );
    } catch {
      return this.getReturnUrl(
        config.returnUrl,
        'pending',
        payment.serviceRequestId,
      );
    }

    const code = reply.data?.code;
    if (code !== 100 && code !== 101) {
      await this.markFailed(
        payment.id,
        reply.data?.message ?? `Zarinpal verification code ${code}`,
      );
      return this.getReturnUrl(
        config.returnUrl,
        'failed',
        payment.serviceRequestId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          referenceId: String(reply.data?.ref_id ?? ''),
          paidAt: new Date(),
          failureReason: null,
        },
      });
      if (updated.count === 0) {
        const current = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });
        if (current?.status !== 'PAID') {
          throw new ConflictException('وضعیت پرداخت تغییر کرده است');
        }
        return;
      }

      const request = await tx.serviceRequest.updateMany({
        where: {
          id: payment.serviceRequestId,
          status: 'CUSTOMER_CONFIRMATION_PENDING',
        },
        data: { status: 'OFFER_ACCEPTED' },
      });
      if (request.count === 0) {
        throw new ConflictException('وضعیت درخواست برای پرداخت معتبر نیست');
      }
    });

    const paymentBody = `پرداخت درخواست «${payment.serviceRequest.title}» با موفقیت انجام شد.`;
    await Promise.all([
      this.notifications.createForUser({
        userId: payment.serviceRequest.customerId,
        category: 'PAYMENTS',
        type: 'PAYMENT_UPDATE',
        title: 'پرداخت موفق',
        body: paymentBody,
        serviceRequestId: payment.serviceRequestId,
      }),
      this.notifications.createForUser({
        userId: payment.serviceRequest.customerId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: 'پیشنهاد تأیید و پرداخت شد',
        body: `درخواست «${payment.serviceRequest.title}» آماده شروع کار است.`,
        serviceRequestId: payment.serviceRequestId,
      }),
      ...(payment.serviceRequest.acceptedProviderProfile
        ? [
            this.notifications.createForUser({
              userId: payment.serviceRequest.acceptedProviderProfile.userId,
              category: 'PAYMENTS' as const,
              type: 'PAYMENT_UPDATE' as const,
              title: 'پرداخت مشتری انجام شد',
              body: `پرداخت درخواست «${payment.serviceRequest.title}» انجام شد.`,
              serviceRequestId: payment.serviceRequestId,
            }),
            this.notifications.createForUser({
              userId: payment.serviceRequest.acceptedProviderProfile.userId,
              category: 'WORK_UPDATES',
              type: 'SERVICE_REQUEST_STATUS',
              title: 'درخواست آماده شروع است',
              body: `پرداخت درخواست «${payment.serviceRequest.title}» تأیید شد.`,
              serviceRequestId: payment.serviceRequestId,
            }),
          ]
        : []),
    ]);

    return this.getReturnUrl(
      config.returnUrl,
      'success',
      payment.serviceRequestId,
    );
  }

  private async handleCustomerWalletTopupCallback(
    authority: string,
    status: string | undefined,
    config: ReturnType<PaymentsService['getConfig']>,
  ) {
    const topup = await this.prisma.customerWalletTopup.findUnique({
      where: { authority },
      include: {
        customerWallet: {
          include: { customerProfile: { select: { userId: true } } },
        },
      },
    });
    if (!topup) return this.getWalletReturnUrl(config.returnUrl, 'failed');
    if (topup.status === 'PAID') {
      return this.getWalletReturnUrl(config.returnUrl, 'success');
    }
    if (topup.status !== 'PENDING' || status?.toUpperCase() !== 'OK') {
      await this.markCustomerWalletTopupFailed(
        topup.id,
        'پرداخت توسط کاربر لغو شد',
      );
      return this.getWalletReturnUrl(config.returnUrl, 'failed');
    }

    let reply: ZarinpalReply;
    try {
      reply = await this.post<ZarinpalReply>(
        this.getApiUrl(config.sandbox, 'verify'),
        {
          merchant_id: config.merchantId,
          amount: topup.amountToman * 10,
          authority,
        },
      );
    } catch {
      return this.getWalletReturnUrl(config.returnUrl, 'pending');
    }

    const code = reply.data?.code;
    if (code !== 100 && code !== 101) {
      await this.markCustomerWalletTopupFailed(
        topup.id,
        reply.data?.message ?? `Zarinpal verification code ${code}`,
      );
      return this.getWalletReturnUrl(config.returnUrl, 'failed');
    }

    const credited = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerWalletTopup.updateMany({
        where: { id: topup.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          referenceId: String(reply.data?.ref_id ?? ''),
          paidAt: new Date(),
          failureReason: null,
        },
      });
      if (!updated.count) {
        const current = await tx.customerWalletTopup.findUnique({
          where: { id: topup.id },
          select: { status: true },
        });
        if (current?.status === 'PAID') return false;
        throw new ConflictException('وضعیت شارژ کیف پول تغییر کرده است');
      }

      await tx.customerWallet.update({
        where: { id: topup.customerWalletId },
        data: { balance: { increment: topup.amountToman } },
      });
      return true;
    });

    if (credited) {
      try {
        await this.notifications.createForUser({
          userId: topup.customerWallet.customerProfile.userId,
          category: 'PAYMENTS',
          type: 'PAYMENT_UPDATE',
          title: 'شارژ کیف پول انجام شد',
          body: `مبلغ ${topup.amountToman.toLocaleString('fa-IR')} تومان به کیف پول شما اضافه شد.`,
        });
      } catch (error) {
        this.logger.error(
          'Customer wallet top-up notification could not be created',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return this.getWalletReturnUrl(config.returnUrl, 'success');
  }

  async getCustomerPayment(userId: string, requestId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        serviceRequestId: requestId,
        serviceRequest: { customerId: userId },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        serviceRequestId: true,
        amountToman: true,
        status: true,
        referenceId: true,
        failureReason: true,
        paidAt: true,
        createdAt: true,
      },
    });
    if (!payment)
      throw new NotFoundException('پرداختی برای این درخواست پیدا نشد');
    return payment;
  }

  async listMyPayments(userId: string, page: number, pageSize: number) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = { serviceRequest: { customerId: userId } };
    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          serviceRequest: {
            select: {
              id: true,
              title: true,
              status: true,
              specialty: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: payments.map((payment) => ({
        id: payment.id,
        serviceRequestId: payment.serviceRequestId,
        requestTitle: payment.serviceRequest.title,
        specialtyName: payment.serviceRequest.specialty?.name ?? null,
        requestStatus: payment.serviceRequest.status,
        amountToman: payment.amountToman,
        status: payment.status,
        referenceId: payment.referenceId,
        failureReason: payment.failureReason,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async confirmCompletion(userId: string, requestId: string) {
    const completion = await this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findFirst({
        where: {
          id: requestId,
          customerId: userId,
          status: 'AWAITING_CUSTOMER_CONFIRMATION',
          payments: { some: { status: 'PAID' } },
        },
        select: {
          id: true,
          title: true,
          acceptedProviderProfileId: true,
          providerPriceToman: true,
          acceptedProviderProfile: { select: { userId: true } },
        },
      });
      if (
        !request ||
        !request.acceptedProviderProfileId ||
        !request.providerPriceToman ||
        !request.acceptedProviderProfile
      ) {
        throw new NotFoundException('کار آماده‌ی تأیید پیدا نشد');
      }

      const completed = await tx.serviceRequest.updateMany({
        where: {
          id: request.id,
          customerId: userId,
          status: 'AWAITING_CUSTOMER_CONFIRMATION',
          payments: { some: { status: 'PAID' } },
        },
        data: { status: 'COMPLETED' },
      });
      if (!completed.count) {
        throw new ConflictException('وضعیت این کار تغییر کرده است');
      }

      const wallet = await tx.wallet.upsert({
        where: { providerProfileId: request.acceptedProviderProfileId },
        create: { providerProfileId: request.acceptedProviderProfileId },
        update: {},
      });
      const configuration = await tx.walletConfiguration.upsert({
        where: { id: 'global' },
        create: { id: 'global' },
        update: {},
      });
      const grossBalance = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: request.providerPriceToman },
          totalEarned: { increment: request.providerPriceToman },
        },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'EARNING',
          amount: request.providerPriceToman,
          balanceAfter: grossBalance.balance,
          description: `درآمد درخواست ${request.id}`,
          serviceRequestId: request.id,
        },
      });

      const commission = Math.round(
        (request.providerPriceToman * configuration.commissionRate) / 100,
      );
      if (commission > 0) {
        const netBalance = await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: commission } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'COMMISSION',
            amount: -commission,
            balanceAfter: netBalance.balance,
            description: `کارمزد پلتفرم (${configuration.commissionRate}%)`,
            serviceRequestId: request.id,
          },
        });
      }

      return {
        message: 'اتمام کار تأیید و درآمد provider تسویه شد',
        releasedAmountToman: request.providerPriceToman - commission,
        providerUserId: request.acceptedProviderProfile.userId,
        requestTitle: request.title,
      };
    });
    await this.notifications.createForUser({
      userId: completion.providerUserId,
      category: 'WORK_UPDATES',
      type: 'SERVICE_REQUEST_STATUS',
      title: 'پایان کار تأیید شد',
      body: `مشتری پایان درخواست «${completion.requestTitle}» را تأیید کرد.`,
      serviceRequestId: requestId,
    });
    await this.notifications.createForUser({
      userId: completion.providerUserId,
      category: 'PAYMENTS',
      type: 'PAYMENT_UPDATE',
      title: 'درآمد به کیف پول اضافه شد',
      body: `مبلغ ${completion.releasedAmountToman.toLocaleString('fa-IR')} تومان بابت درخواست «${completion.requestTitle}» به کیف پول شما اضافه شد.`,
      serviceRequestId: requestId,
    });
    return {
      message: completion.message,
      releasedAmountToman: completion.releasedAmountToman,
    };
  }

  async raiseDispute(userId: string, requestId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        customerId: userId,
        status: 'AWAITING_CUSTOMER_CONFIRMATION',
        payments: { some: { status: 'PAID' } },
      },
      select: {
        title: true,
        acceptedProviderProfile: { select: { userId: true } },
      },
    });
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        customerId: userId,
        status: 'AWAITING_CUSTOMER_CONFIRMATION',
        payments: { some: { status: 'PAID' } },
      },
      data: { status: 'DISPUTED' },
    });
    if (!result.count) {
      throw new ConflictException('این درخواست آماده‌ی ثبت اختلاف نیست');
    }
    if (request?.acceptedProviderProfile) {
      await this.notifications.createForUser({
        userId: request.acceptedProviderProfile.userId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: 'درخواست وارد بررسی اختلاف شد',
        body: `مشتری درباره درخواست «${request.title}» اختلاف ثبت کرده است.`,
        serviceRequestId: requestId,
      });
    }
    return { message: 'درخواست برای بررسی اختلاف ثبت شد' };
  }

  async listPayments(page: number, pageSize: number, status?: string) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = status
      ? { status: status as 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          serviceRequest: {
            select: {
              id: true,
              title: true,
              customerId: true,
              status: true,
              acceptedProviderProfile: {
                select: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    const customerIds = [
      ...new Set(items.map((item) => item.serviceRequest.customerId)),
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

    return {
      items: items.map((item) => ({
        id: item.id,
        serviceRequestId: item.serviceRequestId,
        requestTitle: item.serviceRequest.title,
        customerId: item.serviceRequest.customerId,
        customerName:
          customerById.get(item.serviceRequest.customerId)?.name ?? null,
        customerPhone:
          customerById.get(item.serviceRequest.customerId)?.phone ?? null,
        providerName:
          item.serviceRequest.acceptedProviderProfile?.user.name ?? null,
        amountToman: item.amountToman,
        status: item.status,
        gateway: item.gateway,
        referenceId: item.referenceId,
        failureReason: item.failureReason,
        paidAt: item.paidAt,
        createdAt: item.createdAt,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  private getConfig() {
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    const callbackUrl = process.env.ZARINPAL_CALLBACK_URL;
    if (!merchantId || !callbackUrl) {
      throw new ServiceUnavailableException('تنظیمات درگاه زرین‌پال کامل نیست');
    }
    return {
      merchantId,
      callbackUrl,
      sandbox: process.env.ZARINPAL_SANDBOX === 'true',
      returnUrl:
        process.env.PAYMENT_RETURN_URL ??
        'http://localhost:3000/payment/result',
    };
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Zarinpal HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  private getApiUrl(sandbox: boolean, action: 'request' | 'verify') {
    const base = sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://payment.zarinpal.com/pg/v4/payment';
    return `${base}/${action}.json`;
  }

  private getStartPayUrl(sandbox: boolean, authority: string) {
    const host = sandbox ? 'sandbox.zarinpal.com' : 'payment.zarinpal.com';
    return `https://${host}/pg/StartPay/${encodeURIComponent(authority)}`;
  }

  private getReturnUrl(
    base: string,
    status: 'success' | 'failed' | 'pending',
    requestId?: string,
  ) {
    const url = new URL(base);
    url.searchParams.set('status', status);
    if (requestId) url.searchParams.set('requestId', requestId);
    return url.toString();
  }

  private getWalletReturnUrl(
    base: string,
    status: 'success' | 'failed' | 'pending',
  ) {
    const url = new URL('/customer/wallet', base);
    url.searchParams.set('topup', status);
    return url.toString();
  }

  private async markFailed(paymentId: string, reason: string) {
    const updated = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: reason },
    });
    if (!updated.count) return;
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        serviceRequestId: true,
        serviceRequest: {
          select: { customerId: true, title: true },
        },
      },
    });
    if (!payment) return;
    await this.notifications.createForUser({
      userId: payment.serviceRequest.customerId,
      category: 'PAYMENTS',
      type: 'PAYMENT_UPDATE',
      title: 'پرداخت ناموفق',
      body: `پرداخت درخواست «${payment.serviceRequest.title}» انجام نشد. می‌توانید دوباره تلاش کنید.`,
      serviceRequestId: payment.serviceRequestId,
    });
  }

  private async markCustomerWalletTopupFailed(topupId: string, reason: string) {
    await this.prisma.customerWalletTopup.updateMany({
      where: { id: topupId, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: reason },
    });
  }
}
