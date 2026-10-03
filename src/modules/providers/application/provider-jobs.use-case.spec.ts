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
