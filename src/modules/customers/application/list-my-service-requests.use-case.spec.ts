import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ListMyServiceRequestsUseCase } from './list-my-service-requests.use-case';

jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ListMyServiceRequestsUseCase', () => {
  it('returns only the requested page and counts customer-owned status groups', async () => {
    const request = {
      id: 'request-1',
      title: 'تعمیرات',
      description: 'توضیحات',
      status: 'OPEN',
      address: null,
      latitude: null,
      longitude: null,
      budgetMin: null,
      budgetMax: null,
      scheduledAt: null,
      customerConfirmationDeadline: null,
      createdAt: new Date('2026-10-01T00:00:00Z'),
      skills: [],
      specialty: null,
      images: [],
      acceptedProviderProfile: null,
      review: null,
      payments: [],
    };
    const prisma = {
      serviceRequest: {
        findMany: jest.fn().mockResolvedValue([request]),
        count: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(11)
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(3),
      },
    };
    const useCase = new ListMyServiceRequestsUseCase(
      prisma as unknown as PrismaService,
    );

    const result = await useCase.executePage('customer-1', {
      page: 2,
      pageSize: 5,
      group: 'active',
    });

    expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerId: 'customer-1',
          status: {
            in: [
              'OPEN',
              'OFFER_ACCEPTED',
              'CUSTOMER_CONFIRMATION_PENDING',
              'IN_PROGRESS',
              'AWAITING_CUSTOMER_CONFIRMATION',
              'DISPUTED',
            ],
          },
        },
        skip: 5,
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 5,
      counts: { active: 11, completed: 4, cancelled: 3 },
      items: [{ id: 'request-1', status: 'awaiting_offers' }],
    });
  });
});
