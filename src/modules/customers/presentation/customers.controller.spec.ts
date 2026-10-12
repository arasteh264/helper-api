import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomersController } from './customers.controller';

jest.mock('../application/get-customer-overview.use-case', () => ({
  GetCustomerOverviewUseCase: class GetCustomerOverviewUseCase {},
}));
jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('CustomersController provider customer access', () => {
  it('allows a provider to use customer address features', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const controller = new CustomersController(
      {} as never,
      { customerAddress: { findMany } } as unknown as PrismaService,
    );

    await expect(
      controller.getAddresses({ userId: 'provider-1', role: 'PROVIDER' }),
    ).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { customerId: 'provider-1' },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  });

  it('continues to reject roles that cannot purchase services', async () => {
    const controller = new CustomersController(
      {} as never,
      { customerAddress: { findMany: jest.fn() } } as unknown as PrismaService,
    );

    await expect(
      controller.getAddresses({ userId: 'admin-1', role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
