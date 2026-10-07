import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ProviderJobsUseCase } from './provider-jobs.use-case';

function createFixture(pricingMode: 'QUOTE' | 'HOURLY', rate: number | null) {
  const transaction = {
    serviceRequest: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'request-1',
        customerId: 'customer-user',
        title: 'تعمیرات',
        specialty: {
          pricingMode,
          hourlyRateToman: rate,
          hourlyUnitLabel: pricingMode === 'HOURLY' ? 'ساعت' : null,
        },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    providerRequestInvitation: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'invitation-1', status: 'PENDING' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    serviceRequest: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        customerId: 'customer-user',
        title: 'تعمیرات',
      }),
    },
    providerProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'provider-profile-1',
        verificationStatus: 'APPROVED',
        isAvailable: true,
        skills: [],
      }),
    },
    $transaction: jest.fn((callback: (db: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  };
  const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
  return {
    useCase: new ProviderJobsUseCase(
      prisma as unknown as PrismaService,
      notifications as never,
    ),
    transaction,
    notifications,
  };
}

describe('ProviderJobsUseCase.accept', () => {
  it('uses the admin hourly rate and provider estimate for hourly specialties', async () => {
    const { useCase, transaction, notifications } = createFixture(
      'HOURLY',
      300000,
    );

    const result = await useCase.accept(
      'provider-user',
      'request-1',
      undefined,
      2.5,
    );

    expect(result).toMatchObject({
      proposedPriceToman: 750000,
      pricingMode: 'HOURLY',
      hourlyRateToman: 300000,
      hourlyUnitLabel: 'ساعت',
      estimatedHours: 2.5,
    });
    expect(transaction.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerPriceToman: 750000,
          providerHourlyRateToman: 300000,
          providerHourlyUnitLabel: 'ساعت',
          providerEstimatedHours: 2.5,
        }),
      }),
    );
    expect(notifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user',
        category: 'OPPORTUNITIES',
      }),
    );
  });

  it('uses the provider proposal for quote-based specialties', async () => {
    const { useCase, transaction } = createFixture('QUOTE', null);

    const result = await useCase.accept('provider-user', 'request-1', 850000);

    expect(result).toMatchObject({
      proposedPriceToman: 850000,
      pricingMode: 'QUOTE',
      hourlyRateToman: null,
      estimatedHours: null,
    });
    expect(transaction.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerPriceToman: 850000,
          providerPricingMode: 'QUOTE',
        }),
      }),
    );
  });
});

describe('ProviderJobsUseCase work status notifications', () => {
  it('lets the assigned provider report non-payment while awaiting payment', async () => {
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'provider-profile-1',
          verificationStatus: 'APPROVED',
          isAvailable: true,
          skills: [],
        }),
      },
      serviceRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          title: 'تعمیرات',
          customerId: 'customer-user',
        }),
      },
    };
    const notifications = { createForUser: jest.fn().mockResolvedValue(null) };
    const useCase = new ProviderJobsUseCase(
      prisma as unknown as PrismaService,
      notifications as never,
    );

    await expect(
      useCase.raiseNonPaymentDispute(
        'provider-user',
        'request-1',
        'مشتری مبلغ توافق‌شده را پرداخت نکرده است.',
      ),
    ).resolves.toEqual({ message: 'اختلاف پرداخت برای بررسی ثبت شد' });
    expect(prisma.serviceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'request-1',
          acceptedProviderProfileId: 'provider-profile-1',
          status: 'CUSTOMER_CONFIRMATION_PENDING',
          payments: { none: { status: 'PAID' } },
        },
        data: expect.objectContaining({
          status: 'DISPUTED',
          disputeReason: 'CUSTOMER_NON_PAYMENT',
        }),
      }),
    );
    expect(notifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-user' }),
    );
  });

  it('notifies the customer when the assigned provider completes the work', async () => {
    const { useCase, notifications } = createFixture('QUOTE', null);

    await expect(
      useCase.complete('provider-user', 'request-1'),
    ).resolves.toEqual({
      message: 'کار برای تأیید مشتری ارسال شد',
    });

    expect(notifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user',
        category: 'WORK_UPDATES',
        serviceRequestId: 'request-1',
      }),
    );
  });
});

describe('ProviderJobsUseCase.list contact privacy', () => {
  it('returns customer phone only when the latest payment is paid', async () => {
    const createdAt = new Date('2026-09-24T10:00:00.000Z');
    const makeRequest = (
      id: string,
      status: string,
      paymentStatus: string,
    ) => ({
      id,
      title: 'تعمیرات',
      customerId: 'customer-user',
      status,
      address: 'نشانی مشتری',
      scheduledAt: null,
      createdAt,
      providerPriceToman: 300000,
      providerPricingMode: 'QUOTE',
      providerHourlyRateToman: null,
      providerHourlyUnitLabel: null,
      providerEstimatedHours: null,
      description: 'شرح درخواست',
      specialty: { name: 'تعمیرات' },
      skills: [],
      images: [],
      payments: [{ status: paymentStatus }],
    });
    const prisma = {
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'provider-profile-1',
          verificationStatus: 'APPROVED',
          isAvailable: true,
          skills: [],
        }),
      },
      providerRequestInvitation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceRequest: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            makeRequest('paid-request', 'OFFER_ACCEPTED', 'PAID'),
            makeRequest(
              'unpaid-request',
              'CUSTOMER_CONFIRMATION_PENDING',
              'PENDING',
            ),
          ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'customer-user',
            name: 'مشتری',
            phone: '09120000000',
          },
        ]),
      },
    };
    const useCase = new ProviderJobsUseCase(
      prisma as unknown as PrismaService,
      {} as never,
    );

    const jobs = await useCase.list('provider-user');

    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'paid-request',
          customerPhone: '09120000000',
          paymentStatus: 'PAID',
        }),
        expect.objectContaining({
          id: 'unpaid-request',
          customerPhone: undefined,
          paymentStatus: 'PENDING',
        }),
      ]),
    );
  });
});
