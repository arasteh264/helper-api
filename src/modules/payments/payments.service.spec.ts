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
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
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
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as never,
    );
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { code: 100, ref_id: 123456 } }),
    } as Response);

    const redirect = await service.handleCallback('A0001', 'OK');

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
  });
});
