import { ConflictException } from '@nestjs/common';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { ServiceRequestController } from './service-request.controller';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaServiceMock {},
}));

describe('ServiceRequestController reviews', () => {
  const review = {
    id: 'review-1',
    rating: 5,
    text: 'کار عالی بود',
    createdAt: new Date('2026-10-05T08:00:00.000Z'),
  };
  const tx = {
    serviceRequestReview: {
      create: jest.fn().mockResolvedValue(review),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.5 } }),
    },
    providerProfile: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    serviceRequest: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const controller = new ServiceRequestController(
    {} as never,
    {} as never,
    {} as never,
    prisma as never,
    {} as never,
    {} as never,
  );
  const customer = { userId: 'customer-1', role: 'CUSTOMER' } as TokenPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.serviceRequest.findFirst.mockResolvedValue({
      id: 'request-1',
      acceptedProviderProfileId: 'provider-profile-1',
      review: null,
    });
    tx.serviceRequestReview.create.mockResolvedValue(review);
    tx.serviceRequestReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
    });
  });

  it('stores one review and updates the provider average for an owned completed job', async () => {
    const result = await controller.reviewCompletedRequest(
      customer,
      'request-1',
      {
        rating: 5,
        text: 'کار عالی بود',
      },
    );

    expect(prisma.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'request-1',
        customerId: 'customer-1',
        status: 'COMPLETED',
      },
      select: expect.objectContaining({
        acceptedProviderProfileId: true,
        review: { select: { id: true } },
      }),
    });
    expect(tx.serviceRequestReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceRequestId: 'request-1',
        customerId: 'customer-1',
        providerProfileId: 'provider-profile-1',
        rating: 5,
      }),
      select: { id: true, rating: true, text: true, createdAt: true },
    });
    expect(tx.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'provider-profile-1' },
      data: { rating: 4.5 },
    });
    expect(result).toEqual(review);
  });

  it('does not allow a second review for the same request', async () => {
    prisma.serviceRequest.findFirst.mockResolvedValueOnce({
      id: 'request-1',
      acceptedProviderProfileId: 'provider-profile-1',
      review: { id: 'existing-review' },
    });

    await expect(
      controller.reviewCompletedRequest(customer, 'request-1', {
        rating: 5,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
