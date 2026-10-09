import { CreateServiceRequestUseCase } from './create-service-request.use-case';
import { ServiceRequestStatus } from '../domain/entities/service-request-status.enum';

jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaServiceMock {},
}));

describe('CreateServiceRequestUseCase', () => {
  const repository = { save: jest.fn() };
  const skills = { findOrCreateByName: jest.fn() };
  const prisma = { walletConfiguration: { findUnique: jest.fn() } };
  const useCase = new CreateServiceRequestUseCase(
    repository as never,
    skills as never,
    prisma as never,
  );
  const input = {
    customerId: 'customer-1',
    title: 'تعمیرات',
    description: 'شرح درخواست',
    skillName: 'برق‌کاری',
    address: 'تهران',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    skills.findOrCreateByName.mockResolvedValue({
      id: 'skill-1',
      name: 'برق‌کاری',
    });
  });

  it('adds a legacy skill before holding a request for review', async () => {
    prisma.walletConfiguration.findUnique.mockResolvedValue({
      requireServiceRequestReview: true,
    });

    const request = await useCase.execute(input);

    expect(request.skillIds).toEqual(['skill-1']);
    expect(request.status).toBe(ServiceRequestStatus.PENDING_ADMIN_REVIEW);
    expect(repository.save).toHaveBeenCalledWith(request);
  });

  it('leaves new requests open when admin review is disabled', async () => {
    prisma.walletConfiguration.findUnique.mockResolvedValue({
      requireServiceRequestReview: false,
    });

    const request = await useCase.execute(input);

    expect(request.status).toBe(ServiceRequestStatus.OPEN);
    expect(repository.save).toHaveBeenCalledWith(request);
  });
});
