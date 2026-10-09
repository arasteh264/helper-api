import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentsService } from './payments.service';

function setPaymentConfig() {
  process.env.ZARINPAL_MERCHANT_ID = 'test-merchant';
  process.env.ZARINPAL_CALLBACK_URL =
    'https://api.example.test/payments/zarinpal/callback';
  process.env.ZARINPAL_SANDBOX = 'true';
  process.env.PAYMENT_RETURN_URL = 'https://site.example.test/payment/result';
}

describe('PaymentsService', () => {
  const originalEnvironment = {
    merchantId: process.env.ZARINPAL_MERCHANT_ID,
    callbackUrl: process.env.ZARINPAL_CALLBACK_URL,
    sandbox: process.env.ZARINPAL_SANDBOX,
    returnUrl: process.env.PAYMENT_RETURN_URL,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ZARINPAL_MERCHANT_ID = originalEnvironment.merchantId;
    process.env.ZARINPAL_CALLBACK_URL = originalEnvironment.callbackUrl;
    process.env.ZARINPAL_SANDBOX = originalEnvironment.sandbox;
    process.env.PAYMENT_RETURN_URL = originalEnvironment.returnUrl;
  });

  it('creates a sandbox checkout using rial conversion and the fixed quote', async () => {
    setPaymentConfig();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          status: 'CUSTOMER_CONFIRMATION_PENDING',
          providerPriceToman: 300000,
          payments: [],
        }),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const notifications = {
      createForUser: jest.fn().mockResolvedValue(null),
      sendProviderJobConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { code: 100, authority: 'A0001' } }),
    } as Response);

    const result = await service.createCheckout('customer-1', 'request-1');
    const [, fetchOptions] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(String(fetchOptions?.body));

    expect(requestBody).toMatchObject({
      merchant_id: 'test-merchant',
      amount: 3000000,
      callback_url: 'https://api.example.test/payments/zarinpal/callback',
    });
    expect(result).toEqual({
      paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A0001',
      requestId: 'request-1',
    });
  });

  it('charges the buyer wallet atomically and advances an accepted quote', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          title: 'تعمیرات',
          status: 'CUSTOMER_CONFIRMATION_PENDING',
          providerPriceToman: 300000,
          acceptedProviderProfile: { userId: 'provider-1' },
          payments: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        findUnique: jest.fn().mockResolvedValue({ balance: 500000 }),
        update: jest.fn().mockResolvedValue({ balance: 200000 }),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = {
      createForUser: jest.fn().mockResolvedValue(null),
      sendProviderJobConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    const result = await service.payFromWallet('buyer-1', 'request-1');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        balance: { decrement: 300000 },
        totalSpent: { increment: 300000 },
      },
      select: { balance: true },
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceRequestId: 'request-1',
        amountToman: 300000,
        gateway: 'WALLET',
        status: 'PAID',
      }),
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OFFER_ACCEPTED' } }),
    );
    expect(result).toEqual({
      status: 'PAID',
      requestId: 'request-1',
      amountToman: 300000,
      walletBalanceToman: 200000,
    });
    expect(notifications.createForUser).toHaveBeenCalledTimes(4);
    expect(notifications.sendProviderJobConfirmationEmail).toHaveBeenCalledWith(
      'provider-1',
      'تعمیرات',
      'request-1',
    );
  });

  it('credits a wallet top-up only after Zarinpal verifies the callback', async () => {
    setPaymentConfig();
    const topup = {
      id: 'topup-1',
      customerWalletId: 'wallet-1',
      amountToman: 50000,
      status: 'PENDING',
      customerWallet: { customerProfile: { userId: 'buyer-1' } },
    };
    const tx = {
      customerWalletTopup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      customerWallet: {
        update: jest.fn().mockResolvedValue({ balance: 50000 }),
      },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      customerWalletTopup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(topup),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = {
      createForUser: jest.fn().mockResolvedValue(null),
      sendProviderJobConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { code: 100, ref_id: 98765 } }),
    } as Response);

    const redirect = await service.handleCallback('A0002', 'OK');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      expect.objectContaining({ body: expect.stringContaining('500000') }),
    );
    expect(tx.customerWalletTopup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'topup-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID', referenceId: '98765' }),
      }),
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: 50000 } },
    });
    expect(redirect).toContain('/customer/wallet?topup=success');
    expect(notifications.createForUser).toHaveBeenCalledTimes(1);
  });

  it('does not debit or create a payment when the buyer wallet is insufficient', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          title: 'تعمیرات',
          status: 'CUSTOMER_CONFIRMATION_PENDING',
          providerPriceToman: 300000,
          acceptedProviderProfile: { userId: 'provider-1' },
          payments: [],
        }),
        updateMany: jest.fn(),
      },
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        findUnique: jest.fn().mockResolvedValue({ balance: 100000 }),
        update: jest.fn(),
      },
      payment: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    await expect(service.payFromWallet('buyer-1', 'request-1')).rejects.toThrow(
      'موجودی کیف پول برای پرداخت کافی نیست',
    );

    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
    expect(notifications.createForUser).not.toHaveBeenCalled();
  });

  it('auto-confirms only expired customer-confirmation requests', async () => {
    const prisma = {
      serviceRequest: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'request-expired', customerId: 'customer-1' },
          ]),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const confirm = jest
      .spyOn(service, 'confirmCompletion')
      .mockResolvedValue({} as never);

    await service.processExpiredCustomerConfirmations();

    expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'AWAITING_CUSTOMER_CONFIRMATION',
          payments: { some: { status: 'PAID' } },
        }),
      }),
    );
    expect(confirm).toHaveBeenCalledWith('customer-1', 'request-expired', true);
  });

  it('retries Zarinpal verification only for a pending payment owned by the customer', async () => {
    const prisma = {
      payment: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            authority: 'A0001',
            gateway: 'ZARINPAL',
            status: 'PENDING',
          })
          .mockResolvedValueOnce({
            id: 'payment-1',
            serviceRequestId: 'request-1',
            amountToman: 300000,
            status: 'PAID',
            referenceId: '12345',
            failureReason: null,
            paidAt: new Date(),
            createdAt: new Date(),
          }),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const callback = jest
      .spyOn(service, 'handleCallback')
      .mockResolvedValue('https://site.example.test/payment/result');

    const result = await service.verifyCustomerPayment(
      'customer-1',
      'request-1',
    );

    expect(prisma.payment.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        serviceRequestId: 'request-1',
        serviceRequest: { customerId: 'customer-1' },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { authority: true, gateway: true, status: true },
    });
    expect(callback).toHaveBeenCalledWith('A0001', undefined);
    expect(result.status).toBe('PAID');
  });

  it('does not attempt verification for a payment outside the customer account', async () => {
    const prisma = {
      payment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const callback = jest.spyOn(service, 'handleCallback');

    await expect(
      service.verifyCustomerPayment('customer-1', 'other-request'),
    ).rejects.toThrow('پرداختی برای این درخواست پیدا نشد');
    expect(callback).not.toHaveBeenCalled();
  });

  it('releases Provider earnings only inside customer completion confirmation', async () => {
    const tx = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          title: 'تعمیرات',
          customerId: 'customer-1',
          acceptedProviderProfileId: 'provider-profile-1',
          providerPriceToman: 500000,
          acceptedProviderProfile: { userId: 'provider-1' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ balance: 500000 })
          .mockResolvedValueOnce({ balance: 450000 }),
      },
      walletConfiguration: {
        upsert: jest.fn().mockResolvedValue({
          id: 'global',
          commissionRate: 10,
        }),
      },
      walletTransaction: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    const result = await service.confirmCompletion('customer-1', 'request-1');

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerId: 'customer-1' }),
        data: {
          status: 'COMPLETED',
          customerConfirmationDeadline: null,
        },
      }),
    );
    expect(tx.wallet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'wallet-1' },
      data: {
        balance: { increment: 500000 },
        totalEarned: { increment: 500000 },
      },
    });
    expect(result.releasedAmountToman).toBe(450000);
  });

  it('lets the customer withdraw an active dispute and confirm completion', async () => {
    const prisma = {};
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const confirm = jest
      .spyOn(service, 'confirmCompletion')
      .mockResolvedValue({ status: 'COMPLETED' } as never);

    await service.confirmDisputedCompletion('customer-1', 'request-1');

    expect(confirm).toHaveBeenCalledWith(
      'customer-1',
      'request-1',
      false,
      'DISPUTED',
      {
        resolution: 'PROVIDER',
        resolvedByUserId: 'customer-1',
        actor: 'CUSTOMER',
        reason:
          'مشتری پس از ثبت اختلاف، با انجام کار موافقت و اختلاف را پس گرفت.',
      },
    );
  });

  it('only allows disputes before the customer confirmation deadline', async () => {
    const request = {
      title: 'تعمیرات',
      acceptedProviderProfile: { userId: 'provider-1' },
    };
    const prisma = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue(request),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    await service.raiseDispute(
      'customer-1',
      'request-1',
      'WORK_QUALITY',
      'کیفیت اجرا با توافق اولیه مطابقت ندارد',
    );

    expect(prisma.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: 'customer-1',
          customerConfirmationDeadline: { gt: expect.any(Date) },
        }),
        data: {
          status: 'DISPUTED',
          customerConfirmationDeadline: null,
          disputeReason: 'WORK_QUALITY',
          disputeDescription: 'کیفیت اجرا با توافق اولیه مطابقت ندارد',
          disputeUpdatedAt: expect.any(Date),
        },
      }),
    );
  });

  it('allows a customer to update an active dispute before admin resolution', async () => {
    const prisma = {
      serviceRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      { createForUser: jest.fn() } as never,
    );

    await service.updateDispute(
      'customer-1',
      'request-1',
      'PRICE_DISAGREEMENT',
      'هزینه‌ی ثبت‌شده بیشتر از مبلغ مورد توافق است',
    );

    expect(prisma.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'request-1',
        customerId: 'customer-1',
        status: 'DISPUTED',
        disputeResolvedAt: null,
      },
      data: {
        disputeReason: 'PRICE_DISAGREEMENT',
        disputeDescription: 'هزینه‌ی ثبت‌شده بیشتر از مبلغ مورد توافق است',
        disputeUpdatedAt: expect.any(Date),
      },
    });
  });

  it('stores admin dispute follow-up messages and notifies both participants', async () => {
    const message = {
      id: 'message-1',
      body: 'لطفاً تصویر فاکتور را ارسال کنید',
      createdAt: new Date('2026-10-07T09:00:00.000Z'),
      author: { id: 'admin-1', name: 'مدیر', role: 'ADMIN' },
    };
    const tx = {
      serviceRequestDisputeMessage: {
        create: jest.fn().mockResolvedValue(message),
      },
      serviceRequest: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          title: 'تعمیرات',
          customerId: 'customer-1',
          acceptedProviderProfile: { userId: 'provider-1' },
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    await expect(
      service.addAdminDisputeMessage(
        'request-1',
        'admin-1',
        '  لطفاً تصویر فاکتور را ارسال کنید  ',
      ),
    ).resolves.toEqual(message);

    expect(tx.serviceRequestDisputeMessage.create).toHaveBeenCalledWith({
      data: {
        serviceRequestId: 'request-1',
        authorUserId: 'admin-1',
        body: 'لطفاً تصویر فاکتور را ارسال کنید',
      },
      select: expect.any(Object),
    });
    expect(notifications.createForUser).toHaveBeenCalledTimes(2);
  });

  it('closes an unpaid provider dispute without issuing a refund or settlement', async () => {
    const disputed = {
      id: 'request-1',
      title: 'تعمیرات',
      customerId: 'customer-1',
      acceptedProviderProfile: { userId: 'provider-1' },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue(disputed),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          customerId: 'customer-1',
          payments: [],
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    await expect(
      service.resolveDisputedRequestByAdmin(
        'request-1',
        'PROVIDER',
        'admin-1',
        'مشتری وجه توافق‌شده را پرداخت نکرده است',
      ),
    ).resolves.toMatchObject({
      requestId: 'request-1',
      resolution: 'PROVIDER',
      status: 'CANCELLED',
    });
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          disputeResolution: 'PROVIDER',
        }),
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'DISPUTE_RESOLVED',
        targetType: 'SERVICE_REQUEST',
        targetId: 'request-1',
        reason: 'مشتری وجه توافق‌شده را پرداخت نکرده است',
      }),
    });
    expect(notifications.createForUser).toHaveBeenCalledTimes(2);
  });

  it('lets an admin resolve a dispute in the Provider favor through the settlement path', async () => {
    const prisma = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          customerId: 'customer-1',
          payments: [{ id: 'payment-1', amountToman: 300000 }],
        }),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const confirm = jest
      .spyOn(service, 'confirmCompletion')
      .mockResolvedValue({ status: 'COMPLETED' } as never);

    await service.resolveDisputedRequestByAdmin(
      'request-1',
      'PROVIDER',
      'admin-1',
      'کار طبق توافق انجام شده است',
    );

    expect(confirm).toHaveBeenCalledWith(
      'customer-1',
      'request-1',
      false,
      'DISPUTED',
      {
        resolution: 'PROVIDER',
        resolvedByUserId: 'admin-1',
        reason: 'کار طبق توافق انجام شده است',
        actor: 'ADMIN',
      },
    );
  });

  it('refunds a disputed service to the buyer wallet without Provider earnings', async () => {
    const disputedRequest = {
      id: 'request-1',
      title: 'تعمیرات',
      customerId: 'customer-1',
      payments: [{ id: 'payment-1', amountToman: 300000 }],
      acceptedProviderProfile: { userId: 'provider-1' },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
      serviceRequest: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'request-1',
            customerId: 'customer-1',
            payments: [{ id: 'payment-1', amountToman: 300000 }],
          })
          .mockResolvedValue(disputedRequest),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      customerProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ balance: 50000, totalSpent: 200000 }),
        update: jest.fn().mockResolvedValue({ balance: 350000 }),
      },
      customerWalletTopup: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      serviceRequest: {
        findFirst: jest.fn().mockResolvedValue(disputedRequest),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    const result = await service.resolveDisputedRequestByAdmin(
      'request-1',
      'BUYER',
      'admin-1',
      'مدرک کافی برای انجام کار ارائه نشده است',
    );

    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: 'DISPUTED' },
      data: expect.objectContaining({
        status: 'CANCELLED',
        disputeResolution: 'BUYER',
        disputeResolutionNote: 'مدرک کافی برای انجام کار ارائه نشده است',
        disputeResolvedById: 'admin-1',
        disputeResolvedAt: expect.any(Date),
      }),
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: 'PAID' },
      data: { status: 'REFUNDED' },
    });
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: {
        balance: { increment: 300000 },
        totalSpent: { decrement: 200000 },
      },
    });
    expect(tx.customerWalletTopup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gateway: 'WALLET',
        status: 'PAID',
        amountToman: 300000,
      }),
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'DISPUTE_RESOLVED',
        targetType: 'SERVICE_REQUEST',
        targetId: 'request-1',
        reason: 'مدرک کافی برای انجام کار ارائه نشده است',
        afterState: expect.objectContaining({
          resolution: 'BUYER',
          refundDestination: 'CUSTOMER_WALLET',
        }),
      }),
    });
    expect(result).toEqual({
      resolution: 'BUYER',
      requestId: 'request-1',
      refundedAmountToman: 300000,
    });
  });

  it('verifies the callback before marking payment paid and advancing the request', async () => {
    setPaymentConfig();
    const tx = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          amountToman: 300000,
          status: 'PENDING',
          serviceRequestId: 'request-1',
          serviceRequest: {
            title: 'تعمیرات',
            customerId: 'customer-1',
            acceptedProviderProfile: { userId: 'provider-1' },
          },
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = {
      createForUser: jest.fn().mockResolvedValue(null),
      sendProviderJobConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { code: 100, ref_id: 123456 } }),
    } as Response);

    const redirect = await service.handleCallback('A0001', 'CANCELLED');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      expect.objectContaining({
        body: expect.stringContaining('3000000'),
      }),
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PAID',
          referenceId: '123456',
        }),
      }),
    );
    expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'OFFER_ACCEPTED' } }),
    );
    expect(redirect).toContain('status=success');
    expect(notifications.createForUser).toHaveBeenCalledTimes(4);
    expect(notifications.sendProviderJobConfirmationEmail).toHaveBeenCalledWith(
      'provider-1',
      'تعمیرات',
      'request-1',
    );
  });

  it('does not repeat gateway verification while a pending payment is in cooldown', async () => {
    setPaymentConfig();
    const prisma = {
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'payment-1',
            amountToman: 300000,
            status: 'PENDING',
            serviceRequestId: 'request-1',
            serviceRequest: { title: 'تعمیرات', customerId: 'customer-1' },
          })
          .mockResolvedValueOnce({ status: 'PENDING' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch');

    const result = await service.handleCallback('A0001', 'OK');

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          OR: [
            { lastVerificationAttemptAt: null },
            { lastVerificationAttemptAt: { lt: expect.any(Date) } },
          ],
        }),
        data: { lastVerificationAttemptAt: expect.any(Date) },
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toContain('status=pending');
  });

  it('verifies wallet top-ups with the gateway instead of trusting callback status', async () => {
    setPaymentConfig();
    const topup = {
      id: 'topup-1',
      customerWalletId: 'wallet-1',
      amountToman: 50000,
      status: 'PENDING',
      customerWallet: { customerProfile: { userId: 'buyer-1' } },
    };
    const tx = {
      customerWalletTopup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      customerWallet: {
        update: jest.fn().mockResolvedValue({ balance: 50000 }),
      },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      customerWalletTopup: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(topup),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { code: 100, ref_id: 98765 } }),
    } as Response);

    const redirect = await service.handleCallback('A0002', 'CANCELLED');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
      expect.objectContaining({ body: expect.stringContaining('500000') }),
    );
    expect(redirect).toContain('/customer/wallet?topup=success');
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: 50000 } },
    });
  });
});
