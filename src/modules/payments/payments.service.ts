import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import { NotificationsService } from '../notifications/notifications.service';
import type { DisputeReason } from '../../../generated/prisma/enums';

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
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly verificationCooldownMs = 15_000;
  private autoConfirmationTimer?: NodeJS.Timeout;
  private pendingVerificationSweepRunning = false;

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    this.scheduleExpiredCustomerConfirmationSweep();
    this.schedulePendingGatewayVerificationSweep();
    this.autoConfirmationTimer = setInterval(() => {
      this.scheduleExpiredCustomerConfirmationSweep();
      this.schedulePendingGatewayVerificationSweep();
    }, 60_000);
    this.autoConfirmationTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.autoConfirmationTimer) clearInterval(this.autoConfirmationTimer);
  }

  async processExpiredCustomerConfirmations() {
    const expired = await this.prisma.serviceRequest.findMany({
      where: {
        status: 'AWAITING_CUSTOMER_CONFIRMATION',
        customerConfirmationDeadline: { lte: new Date() },
        payments: { some: { status: 'PAID' } },
      },
      select: { id: true, customerId: true },
      take: 100,
      orderBy: { customerConfirmationDeadline: 'asc' },
    });

    for (const request of expired) {
      try {
        await this.confirmCompletion(request.customerId, request.id, true);
      } catch (error) {
        this.logger.error(
          `Automatic completion failed for request ${request.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private scheduleExpiredCustomerConfirmationSweep() {
    void this.processExpiredCustomerConfirmations().catch((error: unknown) => {
      this.logger.error(
        'Expired customer confirmation sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  private schedulePendingGatewayVerificationSweep() {
    void this.processPendingGatewayVerifications().catch((error: unknown) => {
      this.logger.error(
        'Pending gateway verification sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async processPendingGatewayVerifications() {
    if (this.pendingVerificationSweepRunning) return;
    this.pendingVerificationSweepRunning = true;
    const retryBefore = new Date(Date.now() - this.verificationCooldownMs);
    const olderThan = new Date(Date.now() - 60_000);
    try {
      const [payments, topups] = await Promise.all([
        this.prisma.payment.findMany({
          where: {
            gateway: 'ZARINPAL',
            status: 'PENDING',
            authority: { not: null },
            createdAt: { lte: olderThan },
            OR: [
              { lastVerificationAttemptAt: null },
              { lastVerificationAttemptAt: { lt: retryBefore } },
            ],
          },
          select: { authority: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        }),
        this.prisma.customerWalletTopup.findMany({
          where: {
            gateway: 'ZARINPAL',
            status: 'PENDING',
            authority: { not: null },
            createdAt: { lte: olderThan },
            OR: [
              { lastVerificationAttemptAt: null },
              { lastVerificationAttemptAt: { lt: retryBefore } },
            ],
          },
          select: { authority: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        }),
      ]);

      const authorities = [...payments, ...topups]
        .map(({ authority }) => authority)
        .filter((authority): authority is string => authority !== null);
      for (let index = 0; index < authorities.length; index += 5) {
        await Promise.all(
          authorities.slice(index, index + 5).map(async (authority) => {
            try {
              await this.handleCallback(authority, undefined);
            } catch (error) {
              this.logger.error(
                'Pending gateway verification failed',
                error instanceof Error ? error.stack : String(error),
              );
            }
          }),
        );
      }
    } finally {
      this.pendingVerificationSweepRunning = false;
    }
  }

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
    const [topups, walletPayments] = await Promise.all([
      this.prisma.customerWalletTopup.findMany({
        where: { customerWalletId: wallet.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          amountToman: true,
          gateway: true,
          status: true,
          referenceId: true,
          failureReason: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          gateway: 'WALLET',
          serviceRequest: { customerId: userId },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          amountToman: true,
          createdAt: true,
          paidAt: true,
          serviceRequest: { select: { title: true } },
        },
      }),
    ]);

    const transactions = [
      ...topups.map((topup) => ({
        id: topup.id,
        type:
          topup.gateway === 'WALLET' ? ('refund' as const) : ('topup' as const),
        date: topup.createdAt,
        description:
          topup.gateway === 'WALLET'
            ? 'بازگشت وجه اختلاف به کیف پول'
            : topup.status === 'PAID'
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
      ...walletPayments.map((payment) => ({
        id: payment.id,
        type: 'payment' as const,
        date: payment.paidAt ?? payment.createdAt,
        description: `پرداخت درخواست «${payment.serviceRequest.title}» از کیف پول`,
        amount: -payment.amountToman,
        status: 'completed' as const,
      })),
    ]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, 50);

    return {
      balance: wallet.balance,
      totalSpent: wallet.totalSpent,
      transactions,
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

  async payFromWallet(userId: string, requestId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;

      const request = await tx.serviceRequest.findFirst({
        where: { id: requestId, customerId: userId },
        select: {
          id: true,
          title: true,
          status: true,
          providerPriceToman: true,
          acceptedProviderProfile: { select: { userId: true } },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
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
        throw new ConflictException(
          'یک پرداخت دیگر برای این درخواست در حال انجام است',
        );
      }

      const profile = await tx.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: { id: true },
      });
      const wallet = await tx.customerWallet.upsert({
        where: { customerProfileId: profile.id },
        update: {},
        create: { customerProfileId: profile.id },
        select: { id: true },
      });

      await tx.$queryRaw`SELECT "id" FROM "CustomerWallet" WHERE "id" = ${wallet.id} FOR UPDATE`;
      const currentWallet = await tx.customerWallet.findUnique({
        where: { id: wallet.id },
        select: { balance: true },
      });
      const balanceToman = currentWallet?.balance ?? 0;
      if (balanceToman < request.providerPriceToman) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_WALLET_BALANCE',
          message: 'موجودی کیف پول برای پرداخت کافی نیست',
          balanceToman,
          requiredAmountToman: request.providerPriceToman,
        });
      }

      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: request.providerPriceToman },
          totalSpent: { increment: request.providerPriceToman },
        },
        select: { balance: true },
      });
      await tx.payment.create({
        data: {
          serviceRequestId: request.id,
          amountToman: request.providerPriceToman,
          gateway: 'WALLET',
          status: 'PAID',
          paidAt: new Date(),
        },
      });

      const updatedRequest = await tx.serviceRequest.updateMany({
        where: {
          id: request.id,
          customerId: userId,
          status: 'CUSTOMER_CONFIRMATION_PENDING',
        },
        data: { status: 'OFFER_ACCEPTED' },
      });
      if (!updatedRequest.count) {
        throw new ConflictException('وضعیت درخواست برای پرداخت معتبر نیست');
      }

      return {
        requestId: request.id,
        title: request.title,
        customerId: userId,
        providerUserId: request.acceptedProviderProfile?.userId,
        amountToman: request.providerPriceToman,
        balanceToman: updatedWallet.balance,
      };
    });

    await Promise.all([
      this.notifications.createForUser({
        userId: result.customerId,
        category: 'PAYMENTS',
        type: 'PAYMENT_UPDATE',
        title: 'پرداخت موفق',
        body: `مبلغ ${result.amountToman.toLocaleString('fa-IR')} تومان بابت درخواست «${result.title}» از کیف پول پرداخت شد.`,
        serviceRequestId: result.requestId,
      }),
      this.notifications.createForUser({
        userId: result.customerId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: 'پیشنهاد تأیید و پرداخت شد',
        body: `درخواست «${result.title}» آماده شروع کار است.`,
        serviceRequestId: result.requestId,
      }),
      ...(result.providerUserId
        ? [
            this.notifications.createForUser({
              userId: result.providerUserId,
              category: 'PAYMENTS',
              type: 'PAYMENT_UPDATE',
              title: 'پرداخت مشتری انجام شد',
              body: `پرداخت درخواست «${result.title}» انجام شد.`,
              serviceRequestId: result.requestId,
            }),
            this.notifications.createForUser({
              userId: result.providerUserId,
              category: 'WORK_UPDATES',
              type: 'SERVICE_REQUEST_STATUS',
              title: 'درخواست آماده شروع است',
              body: `پرداخت درخواست «${result.title}» تأیید شد.`,
              serviceRequestId: result.requestId,
            }),
          ]
        : []),
    ]).catch((error: unknown) => {
      this.logger.error(
        'Wallet payment notification could not be created',
        error instanceof Error ? error.stack : String(error),
      );
    });

    if (result.providerUserId) {
      try {
        await this.notifications.sendProviderJobConfirmationEmail(
          result.providerUserId,
          result.title,
          result.requestId,
        );
      } catch (error) {
        this.logger.error(
          'Provider payment confirmation email could not be sent',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      status: 'PAID' as const,
      requestId: result.requestId,
      amountToman: result.amountToman,
      walletBalanceToman: result.balanceToman,
    };
  }

  async handleCallback(
    authority: string | undefined,
    _status: string | undefined,
  ) {
    void _status;
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
      return this.handleCustomerWalletTopupCallback(authority, config);
    }
    if (payment.status === 'PAID') {
      return this.getReturnUrl(
        config.returnUrl,
        'success',
        payment.serviceRequestId,
      );
    }
    if (payment.status !== 'PENDING') {
      return this.getReturnUrl(
        config.returnUrl,
        payment.status === 'FAILED' ? 'failed' : 'pending',
        payment.serviceRequestId,
      );
    }

    const retryBefore = new Date(Date.now() - this.verificationCooldownMs);
    const claimed = await this.prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: 'PENDING',
        OR: [
          { lastVerificationAttemptAt: null },
          { lastVerificationAttemptAt: { lt: retryBefore } },
        ],
      },
      data: { lastVerificationAttemptAt: new Date() },
    });
    if (claimed.count === 0) {
      const current = await this.prisma.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      return this.getReturnUrl(
        config.returnUrl,
        current?.status === 'PAID' ? 'success' : 'pending',
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

    const paymentConfirmed = await this.prisma.$transaction(async (tx) => {
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
        return false;
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
      return true;
    });

    if (
      paymentConfirmed &&
      payment.serviceRequest.acceptedProviderProfile?.userId
    ) {
      try {
        await this.notifications.sendProviderJobConfirmationEmail(
          payment.serviceRequest.acceptedProviderProfile.userId,
          payment.serviceRequest.title,
          payment.serviceRequestId,
        );
      } catch (error) {
        this.logger.error(
          'Provider payment confirmation email could not be sent',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

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
    if (topup.status !== 'PENDING') {
      return this.getWalletReturnUrl(
        config.returnUrl,
        topup.status === 'FAILED' ? 'failed' : 'pending',
      );
    }

    const retryBefore = new Date(Date.now() - this.verificationCooldownMs);
    const claimed = await this.prisma.customerWalletTopup.updateMany({
      where: {
        id: topup.id,
        status: 'PENDING',
        OR: [
          { lastVerificationAttemptAt: null },
          { lastVerificationAttemptAt: { lt: retryBefore } },
        ],
      },
      data: { lastVerificationAttemptAt: new Date() },
    });
    if (!claimed.count) {
      const current = await this.prisma.customerWalletTopup.findUnique({
        where: { id: topup.id },
        select: { status: true },
      });
      return this.getWalletReturnUrl(
        config.returnUrl,
        current?.status === 'PAID' ? 'success' : 'pending',
      );
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

  async verifyCustomerPayment(userId: string, requestId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        serviceRequestId: requestId,
        serviceRequest: { customerId: userId },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        authority: true,
        gateway: true,
        status: true,
      },
    });
    if (!payment) {
      throw new NotFoundException('پرداختی برای این درخواست پیدا نشد');
    }

    if (
      payment.status === 'PENDING' &&
      payment.gateway === 'ZARINPAL' &&
      payment.authority
    ) {
      await this.handleCallback(payment.authority, undefined);
    }

    return this.getCustomerPayment(userId, requestId);
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

  async confirmCompletion(
    userId: string,
    requestId: string,
    autoConfirmed = false,
    expectedStatus:
      | 'AWAITING_CUSTOMER_CONFIRMATION'
      | 'DISPUTED' = 'AWAITING_CUSTOMER_CONFIRMATION',
    disputeResolution?: {
      resolution: 'PROVIDER' | 'BUYER';
      resolvedByUserId: string;
      reason: string;
      actor: 'ADMIN' | 'CUSTOMER';
    },
  ) {
    const adminResolvedDispute =
      expectedStatus === 'DISPUTED' && disputeResolution?.actor === 'ADMIN';
    const customerConfirmedDispute =
      expectedStatus === 'DISPUTED' && disputeResolution?.actor === 'CUSTOMER';
    const completion = await this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findFirst({
        where: {
          id: requestId,
          customerId: userId,
          status: expectedStatus,
          payments: { some: { status: 'PAID' } },
        },
        select: {
          id: true,
          title: true,
          customerId: true,
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
          status: expectedStatus,
          payments: { some: { status: 'PAID' } },
        },
        data: {
          status: 'COMPLETED',
          customerConfirmationDeadline: null,
          ...(disputeResolution
            ? {
                disputeResolution: disputeResolution.resolution,
                disputeResolutionNote: disputeResolution.reason,
                disputeResolvedById: disputeResolution.resolvedByUserId,
                disputeResolvedAt: new Date(),
              }
            : {}),
        },
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
        message: autoConfirmed
          ? 'به دلیل ثبت‌نشدن پاسخ در مهلت مقرر، کار تکمیل و درآمد provider تسویه شد'
          : adminResolvedDispute
            ? 'اختلاف به نفع provider تعیین‌تکلیف و درآمد تسویه شد'
            : customerConfirmedDispute
              ? 'مشتری اختلاف را پس گرفت و انجام کار را تأیید کرد'
            : 'اتمام کار تأیید و درآمد provider تسویه شد',
        releasedAmountToman: request.providerPriceToman - commission,
        providerUserId: request.acceptedProviderProfile.userId,
        customerId: request.customerId,
        requestTitle: request.title,
      };
    });
    const completionNotifications = [
      this.notifications.createForUser({
        userId: completion.providerUserId,
        category: 'WORK_UPDATES' as const,
        type: 'SERVICE_REQUEST_STATUS' as const,
        title: autoConfirmed
          ? 'درخواست به‌طور خودکار تکمیل شد'
          : adminResolvedDispute
            ? 'اختلاف به نفع شما تعیین‌تکلیف شد'
            : customerConfirmedDispute
              ? 'مشتری اختلاف را پس گرفت و کار را تأیید کرد'
            : 'پایان کار تأیید شد',
        body: autoConfirmed
          ? `مهلت پاسخ مشتری برای درخواست «${completion.requestTitle}» به پایان رسید و درآمد آزاد شد.`
          : adminResolvedDispute
            ? `پس از بررسی اختلاف درخواست «${completion.requestTitle}»، درآمد برای شما آزاد شد.`
            : customerConfirmedDispute
              ? `مشتری اختلاف درخواست «${completion.requestTitle}» را پس گرفت و انجام کار را تأیید کرد؛ درآمد برای شما آزاد شد.`
            : `مشتری پایان درخواست «${completion.requestTitle}» را تأیید کرد.`,
        serviceRequestId: requestId,
      }),
      this.notifications.createForUser({
        userId: completion.providerUserId,
        category: 'PAYMENTS' as const,
        type: 'PAYMENT_UPDATE' as const,
        title: 'درآمد به کیف پول اضافه شد',
        body: `مبلغ ${completion.releasedAmountToman.toLocaleString('fa-IR')} تومان بابت درخواست «${completion.requestTitle}» به کیف پول شما اضافه شد.`,
        serviceRequestId: requestId,
      }),
      ...(autoConfirmed || adminResolvedDispute
        ? [
            this.notifications.createForUser({
              userId: completion.customerId,
              category: 'WORK_UPDATES' as const,
              type: 'SERVICE_REQUEST_STATUS' as const,
              title: autoConfirmed
                ? 'درخواست به‌طور خودکار تکمیل شد'
                : 'اختلاف به نفع متخصص تعیین‌تکلیف شد',
              body: autoConfirmed
                ? `مهلت ۷۲ ساعته‌ی بررسی درخواست «${completion.requestTitle}» به پایان رسید؛ اگر مشکلی وجود دارد با پشتیبانی تماس بگیرید.`
                : `پس از بررسی اختلاف درخواست «${completion.requestTitle}»، مبلغ به متخصص پرداخت شد.`,
              serviceRequestId: requestId,
            }),
          ]
        : []),
    ];
    await Promise.all(completionNotifications).catch((error: unknown) => {
      this.logger.error(
        `Completion notification failed for request ${requestId}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
    return {
      message: completion.message,
      releasedAmountToman: completion.releasedAmountToman,
    };
  }

  async confirmDisputedCompletion(userId: string, requestId: string) {
    return this.confirmCompletion(userId, requestId, false, 'DISPUTED', {
      resolution: 'PROVIDER',
      resolvedByUserId: userId,
      actor: 'CUSTOMER',
      reason: 'مشتری پس از ثبت اختلاف، با انجام کار موافقت و اختلاف را پس گرفت.',
    });
  }

  async raiseDispute(
    userId: string,
    requestId: string,
    reason: DisputeReason,
    description: string,
  ) {
    if (reason === 'CUSTOMER_NON_PAYMENT') {
      throw new BadRequestException(
        'این نوع اختلاف فقط توسط متخصص ثبت می‌شود',
      );
    }
    const now = new Date();
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        customerId: userId,
        status: 'AWAITING_CUSTOMER_CONFIRMATION',
        customerConfirmationDeadline: { gt: now },
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
        customerConfirmationDeadline: { gt: now },
        payments: { some: { status: 'PAID' } },
      },
      data: {
        status: 'DISPUTED',
        customerConfirmationDeadline: null,
        disputeReason: reason,
        disputeDescription: description.trim(),
        disputeUpdatedAt: now,
      },
    });
    if (!result.count) {
      throw new ConflictException('این درخواست آماده‌ی ثبت اختلاف نیست');
    }
    if (request?.acceptedProviderProfile) {
      try {
        await this.notifications.createForUser({
          userId: request.acceptedProviderProfile.userId,
          category: 'WORK_UPDATES',
          type: 'SERVICE_REQUEST_STATUS',
          title: 'درخواست وارد بررسی اختلاف شد',
          body: `مشتری درباره درخواست «${request.title}» اختلاف ثبت کرده است.`,
          serviceRequestId: requestId,
        });
      } catch (error) {
        this.logger.error(
          `Dispute notification failed for request ${requestId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return { message: 'درخواست برای بررسی اختلاف ثبت شد' };
  }

  async updateDispute(
    userId: string,
    requestId: string,
    reason: DisputeReason,
    description: string,
  ) {
    if (reason === 'CUSTOMER_NON_PAYMENT') {
      throw new BadRequestException(
        'این نوع اختلاف فقط توسط متخصص ثبت می‌شود',
      );
    }
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        customerId: userId,
        status: 'DISPUTED',
        disputeResolvedAt: null,
      },
      data: {
        disputeReason: reason,
        disputeDescription: description.trim(),
        disputeUpdatedAt: new Date(),
      },
    });
    if (!result.count) {
      throw new ConflictException('اختلاف فعال برای ویرایش پیدا نشد');
    }
    return { message: 'شرح اختلاف به‌روزرسانی شد' };
  }

  async addDisputeMessage(userId: string, requestId: string, body: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        status: 'DISPUTED',
        OR: [
          { customerId: userId },
          { acceptedProviderProfile: { userId } },
        ],
      },
      select: {
        id: true,
        title: true,
        customerId: true,
        acceptedProviderProfile: { select: { userId: true } },
      },
    });
    if (!request) {
      throw new NotFoundException('اختلاف فعال یا دسترسی شما پیدا نشد');
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

    const recipientUserId =
      userId === request.customerId
        ? request.acceptedProviderProfile?.userId
        : request.customerId;
    if (recipientUserId) {
      try {
        await this.notifications.createForUser({
          userId: recipientUserId,
          category: 'WORK_UPDATES',
          type: 'SERVICE_REQUEST_STATUS',
          title: 'پیام جدید درباره‌ی اختلاف',
          body: `پیام جدیدی درباره‌ی درخواست «${request.title}» ثبت شد.`,
          serviceRequestId: requestId,
        });
      } catch (error) {
        this.logger.error(
          `Dispute follow-up notification failed for request ${requestId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return message;
  }

  async addAdminDisputeMessage(requestId: string, adminUserId: string, body: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, status: 'DISPUTED' },
      select: {
        id: true,
        title: true,
        customerId: true,
        acceptedProviderProfile: { select: { userId: true } },
      },
    });
    if (!request) throw new NotFoundException('اختلاف فعال پیدا نشد');

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceRequestDisputeMessage.create({
        data: {
          serviceRequestId: request.id,
          authorUserId: adminUserId,
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

    const recipientIds = [
      request.customerId,
      ...(request.acceptedProviderProfile
        ? [request.acceptedProviderProfile.userId]
        : []),
    ];
    const notificationResults = await Promise.allSettled(
      recipientIds.map((userId) =>
        this.notifications.createForUser({
          userId,
          category: 'WORK_UPDATES',
          type: 'SERVICE_REQUEST_STATUS',
          title: 'پیام جدید از تیم رسیدگی',
          body: `تیم رسیدگی درباره‌ی درخواست «${request.title}» پیام فرستاد.`,
          serviceRequestId: request.id,
        }),
      ),
    );
    notificationResults.forEach((result) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Admin dispute message notification failed for request ${request.id}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
    return message;
  }

  async getDisputeForAdmin(requestId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, status: 'DISPUTED' },
      select: {
        id: true,
        title: true,
        description: true,
        disputeReason: true,
        disputeDescription: true,
        disputeUpdatedAt: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        acceptedProviderProfile: {
          select: {
            user: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { amountToman: true },
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
    });
    if (!request) throw new NotFoundException('اختلاف فعال پیدا نشد');
    return {
      id: request.id,
      title: request.title,
      requestDescription: request.description,
      reason: request.disputeReason,
      description: request.disputeDescription,
      updatedAt: request.disputeUpdatedAt,
      createdAt: request.createdAt,
      amountToman: request.payments[0]?.amountToman ?? null,
      customer: request.customer,
      provider: request.acceptedProviderProfile?.user ?? null,
      messages: request.disputeMessages,
    };
  }

  async resolveDisputedRequestByAdmin(
    requestId: string,
    resolution: 'PROVIDER' | 'BUYER',
    adminUserId: string,
    reason: string,
  ) {
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 1000) {
      throw new BadRequestException('برای حل اختلاف، دلیل معتبر الزامی است');
    }

    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id: requestId,
        status: 'DISPUTED',
      },
      select: {
        id: true,
        customerId: true,
        payments: { where: { status: 'PAID' }, select: { id: true }, take: 1 },
      },
    });
    if (!request) throw new NotFoundException('اختلاف فعال پیدا نشد');

    if (!request.payments.length) {
      const resolved = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${requestId} FOR UPDATE`;
        const disputed = await tx.serviceRequest.findFirst({
          where: {
            id: requestId,
            status: 'DISPUTED',
            payments: { none: { status: 'PAID' } },
          },
          select: {
            id: true,
            title: true,
            customerId: true,
            acceptedProviderProfile: { select: { userId: true } },
          },
        });
        if (!disputed) {
          throw new ConflictException('وضعیت اختلاف تغییر کرده است');
        }
        const updated = await tx.serviceRequest.updateMany({
          where: {
            id: disputed.id,
            status: 'DISPUTED',
            payments: { none: { status: 'PAID' } },
          },
          data: {
            status: 'CANCELLED',
            customerConfirmationDeadline: null,
            disputeResolution: resolution,
            disputeResolutionNote: normalizedReason,
            disputeResolvedById: adminUserId,
            disputeResolvedAt: new Date(),
          },
        });
        if (!updated.count) {
          throw new ConflictException('وضعیت اختلاف تغییر کرده است');
        }
        return disputed;
      });
      const title =
        resolution === 'PROVIDER'
          ? 'اختلاف عدم پرداخت به نفع متخصص تعیین‌تکلیف شد'
          : 'اختلاف عدم پرداخت به نفع مشتری تعیین‌تکلیف شد';
      const recipients = [
        resolved.customerId,
        ...(resolved.acceptedProviderProfile
          ? [resolved.acceptedProviderProfile.userId]
          : []),
      ];
      const notificationResults = await Promise.allSettled(
        recipients.map((userId) =>
          this.notifications.createForUser({
            userId,
            category: 'WORK_UPDATES',
            type: 'SERVICE_REQUEST_STATUS',
            title,
            body: `درخواست «${resolved.title}» پس از بررسی اختلاف لغو شد. نتیجه: ${normalizedReason}`,
            serviceRequestId: resolved.id,
          }),
        ),
      );
      notificationResults.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.error(
            `Unpaid dispute resolution notification failed for request ${resolved.id}`,
            result.reason instanceof Error
              ? result.reason.stack
              : String(result.reason),
          );
        }
      });
      return {
        message: title,
        requestId: resolved.id,
        resolution,
        status: 'CANCELLED',
      };
    }

    if (resolution === 'PROVIDER') {
      return this.confirmCompletion(
        request.customerId,
        request.id,
        false,
        'DISPUTED',
        {
          resolution,
          resolvedByUserId: adminUserId,
          reason: normalizedReason,
          actor: 'ADMIN',
        },
      );
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ServiceRequest" WHERE "id" = ${request.id} FOR UPDATE`;
      const disputedRequest = await tx.serviceRequest.findFirst({
        where: {
          id: request.id,
          customerId: request.customerId,
          status: 'DISPUTED',
          payments: { some: { status: 'PAID' } },
        },
        select: {
          id: true,
          title: true,
          customerId: true,
          payments: {
            where: { status: 'PAID' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, amountToman: true },
          },
          acceptedProviderProfile: { select: { userId: true } },
        },
      });
      const payment = disputedRequest?.payments[0];
      if (!disputedRequest || !payment) {
        throw new ConflictException('وضعیت اختلاف تغییر کرده است');
      }

      const paid = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PAID' },
        data: { status: 'REFUNDED' },
      });
      if (!paid.count)
        throw new ConflictException('پرداخت قبلاً تعیین‌تکلیف شده است');

      const cancelled = await tx.serviceRequest.updateMany({
        where: { id: disputedRequest.id, status: 'DISPUTED' },
        data: {
          status: 'CANCELLED',
          customerConfirmationDeadline: null,
          disputeResolution: resolution,
          disputeResolutionNote: normalizedReason,
          disputeResolvedById: adminUserId,
          disputeResolvedAt: new Date(),
        },
      });
      if (!cancelled.count)
        throw new ConflictException('وضعیت درخواست تغییر کرده است');

      const profile = await tx.customerProfile.upsert({
        where: { userId: disputedRequest.customerId },
        update: {},
        create: { userId: disputedRequest.customerId },
        select: { id: true },
      });
      const wallet = await tx.customerWallet.upsert({
        where: { customerProfileId: profile.id },
        update: {},
        create: { customerProfileId: profile.id },
        select: { id: true },
      });
      await tx.$queryRaw`SELECT "id" FROM "CustomerWallet" WHERE "id" = ${wallet.id} FOR UPDATE`;
      const currentWallet = await tx.customerWallet.findUniqueOrThrow({
        where: { id: wallet.id },
        select: { balance: true, totalSpent: true },
      });
      await tx.customerWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: payment.amountToman },
          totalSpent: {
            decrement: Math.min(currentWallet.totalSpent, payment.amountToman),
          },
        },
      });
      await tx.customerWalletTopup.create({
        data: {
          customerWalletId: wallet.id,
          amountToman: payment.amountToman,
          gateway: 'WALLET',
          status: 'PAID',
          referenceId: `DISPUTE-${disputedRequest.id}`,
          paidAt: new Date(),
        },
      });

      return {
        requestId: disputedRequest.id,
        title: disputedRequest.title,
        customerId: disputedRequest.customerId,
        providerUserId: disputedRequest.acceptedProviderProfile?.userId,
        amountToman: payment.amountToman,
      };
    });

    await Promise.allSettled([
      this.notifications.createForUser({
        userId: refund.customerId,
        category: 'PAYMENTS',
        type: 'PAYMENT_UPDATE',
        title: 'مبلغ اختلاف به کیف پول برگشت',
        body: `مبلغ ${refund.amountToman.toLocaleString('fa-IR')} تومان بابت درخواست «${refund.title}» به کیف پول شما اضافه شد.`,
        serviceRequestId: refund.requestId,
      }),
      ...(refund.providerUserId
        ? [
            this.notifications.createForUser({
              userId: refund.providerUserId,
              category: 'WORK_UPDATES',
              type: 'SERVICE_REQUEST_STATUS',
              title: 'اختلاف به نفع خریدار تعیین‌تکلیف شد',
              body: `درخواست «${refund.title}» لغو و مبلغ به کیف پول خریدار بازگردانده شد.`,
              serviceRequestId: refund.requestId,
            }),
          ]
        : []),
    ]);

    return {
      resolution: 'BUYER' as const,
      requestId: refund.requestId,
      refundedAmountToman: refund.amountToman,
    };
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
