import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PriceAdjustmentsService } from './price-adjustments.service';

type CreateAdjustmentInput = {
  data: {
    serviceRequestId: string;
    proposedByUserId: string;
    status: string;
    amountToman: number;
    previousTotalToman: number;
    newTotalToman: number;
  };
};

jest.mock('../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PriceAdjustmentsService', () => {
  const findRequest = jest.fn();
  const findProvider = jest.fn();
  const findRequestForProvider = jest.fn();
  const findAdjustments = jest.fn();
  const findAdjustment = jest.fn();
  const findActiveAdjustment = jest.fn();
  const createAdjustment = jest.fn(
    (input: CreateAdjustmentInput): Promise<unknown> => Promise.resolve(input),
  );
  const updateAdjustment = jest.fn();
  const createAuditLog = jest.fn();
  const createNotification = jest.fn(
    (input: { data: { userId: string } }) => input,
  );
  const transaction = {
    $queryRaw: jest.fn(),
    serviceRequest: { findFirst: findRequestForProvider },
    serviceRequestPriceAdjustment: {
      findFirst: findActiveAdjustment,
      findUnique: findAdjustment,
      create: createAdjustment,
      updateMany: updateAdjustment,
    },
    adminAuditLog: { create: createAuditLog },
    notification: { create: createNotification },
  };
  const runTransaction = jest.fn(
    (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  const prisma = {
    providerProfile: { findUnique: findProvider },
    serviceRequest: { findFirst: findRequest },
    serviceRequestPriceAdjustment: { findMany: findAdjustments },
    $transaction: runTransaction,
  } as unknown as PrismaService;
  const service = new PriceAdjustmentsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an adjustment for support review without changing the base quote', async () => {
    findProvider.mockResolvedValueOnce({ id: 'provider-profile-1' });
    findRequestForProvider.mockResolvedValueOnce({
      id: 'request-1',
      customerId: 'customer-1',
      title: 'تعمیر شیر آب',
      status: 'IN_PROGRESS',
      providerPriceToman: 300000,
    });
    findActiveAdjustment.mockResolvedValueOnce(null);
    createAdjustment.mockResolvedValueOnce({
      id: 'adjustment-1',
      status: 'PENDING_SUPPORT_REVIEW',
      amountToman: 25000,
      previousTotalToman: 300000,
      newTotalToman: 325000,
    });

    await expect(
      service.createForProvider('provider-1', 'request-1', {
        reason: 'پس از بررسی، قطعه‌ی دیگری نیاز به تعویض دارد.',
        items: [
          {
            description: 'قطعه‌ی تعویضی',
            quantity: 1,
            unitPriceToman: 25000,
          },
        ],
      }),
    ).resolves.toMatchObject({
      status: 'PENDING_SUPPORT_REVIEW',
      amountToman: 25000,
      previousTotalToman: 300000,
      newTotalToman: 325000,
    });

    expect(createAdjustment).toHaveBeenCalledTimes(1);
    expect(createAdjustment.mock.calls[0]?.[0].data).toMatchObject({
      serviceRequestId: 'request-1',
      proposedByUserId: 'provider-1',
      status: 'PENDING_SUPPORT_REVIEW',
      amountToman: 25000,
      previousTotalToman: 300000,
      newTotalToman: 325000,
    });
  });

  it('hides support-pending adjustments from the customer', async () => {
    findRequest.mockResolvedValueOnce({
      id: 'request-1',
      customerId: 'customer-1',
      acceptedProviderProfile: { userId: 'provider-1' },
    });
    findAdjustments.mockResolvedValueOnce([]);

    await service.listForRequest('customer-1', 'request-1');

    expect(findAdjustments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          serviceRequestId: 'request-1',
          status: { not: 'PENDING_SUPPORT_REVIEW' },
        },
      }),
    );
  });

  it('notifies the customer and provider after support approves an adjustment', async () => {
    findAdjustment.mockResolvedValueOnce({
      id: 'adjustment-1',
      status: 'PENDING_SUPPORT_REVIEW',
      serviceRequestId: 'request-1',
      amountToman: 25000,
      serviceRequest: {
        title: 'تعمیر شیر آب',
        customerId: 'customer-1',
        acceptedProviderProfile: { userId: 'provider-1' },
      },
    });
    updateAdjustment.mockResolvedValueOnce({ count: 1 });

    await expect(
      service.reviewBySupport('support-1', 'adjustment-1', {
        decision: 'APPROVE',
      }),
    ).resolves.toEqual(expect.objectContaining({ status: 'PENDING' }));

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(
      createNotification.mock.calls.map(([input]) => input.data.userId),
    ).toEqual(['customer-1', 'provider-1']);
  });

  it('requires a reason when support rejects an adjustment', async () => {
    await expect(
      service.reviewBySupport('support-1', 'adjustment-1', {
        decision: 'REJECT',
        note: '  ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
