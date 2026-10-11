import { CreateServiceRequestUseCase } from './create-service-request.use-case';
import { ServiceRequestStatus } from '../domain/entities/service-request-status.enum';

jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CreateServiceRequestUseCase admin review setting', () => {
  const scenarios: [boolean | null, ServiceRequestStatus][] = [
    [true, ServiceRequestStatus.PENDING_ADMIN_REVIEW],
    [false, ServiceRequestStatus.OPEN],
    [null, ServiceRequestStatus.PENDING_ADMIN_REVIEW],
  ];

  function createUseCase(requireServiceRequestReview: boolean | null) {
    const repository = { save: jest.fn() };
    const prisma = {
      specialty: {
        findFirst: jest.fn().mockResolvedValue({ id: 'specialty-1' }),
      },
      walletConfiguration: {
        findUnique: jest
          .fn()
          .mockResolvedValue(
            requireServiceRequestReview === null
              ? null
              : { requireServiceRequestReview },
          ),
      },
    };
    const useCase = new CreateServiceRequestUseCase(
      repository as never,
      {} as never,
      prisma as never,
    );
    return { useCase, repository };
  }

  it.each(scenarios)(
    'creates requests with the review setting %s',
    async (requireReview, expectedStatus) => {
      const { useCase, repository } = createUseCase(requireReview);

      const request = await useCase.execute({
        customerId: 'customer-1',
        title: 'Request',
        description: 'Description',
        specialtyId: 'specialty-1',
        address: 'Address',
      });

      expect(request.status).toBe(expectedStatus);
      expect(repository.save).toHaveBeenCalledWith(request);
    },
  );
});
