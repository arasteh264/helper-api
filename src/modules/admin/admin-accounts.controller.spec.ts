import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { AdminAccountsController } from './admin-accounts.controller';

jest.mock('../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminAccountsController', () => {
  const tx = {
    user: { updateMany: jest.fn() },
    providerProfile: { updateMany: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const controller = new AdminAccountsController(prisma as never);
  const admin = { userId: 'admin-1', role: 'ADMIN' } as TokenPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.providerProfile.updateMany.mockResolvedValue({ count: 1 });
    tx.adminAuditLog.create.mockResolvedValue({});
  });

  it('requires an audit reason before changing a user status', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'customer-1',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await controller.updateStatus(admin, 'customer-1', {
      status: 'SUSPENDED',
      reason: '  repeated abuse report  ',
    });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'customer-1', status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: 'customer-1',
        reason: 'repeated abuse report',
      }),
    });
  });

  it('disables provider availability when suspending the account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'provider-user-1',
      role: 'PROVIDER',
      status: 'ACTIVE',
    });

    await controller.updateStatus(admin, 'provider-user-1', {
      status: 'SUSPENDED',
      reason: 'دریافت گزارش تخلف',
    });

    expect(tx.providerProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'provider-user-1' },
      data: { isAvailable: false },
    });
  });

  it('does not allow an administrator to suspend their own account', async () => {
    await expect(
      controller.updateStatus(admin, admin.userId, {
        status: 'SUSPENDED',
        reason: 'test reason',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow administrator accounts to be changed through this endpoint', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'other-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    await expect(
      controller.updateStatus(admin, 'other-admin', {
        status: 'SUSPENDED',
        reason: 'test reason',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      controller.updateStatus(admin, 'missing', {
        status: 'SUSPENDED',
        reason: 'test reason',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a concurrent update instead of silently overwriting it', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'customer-1',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      controller.updateStatus(admin, 'customer-1', {
        status: 'SUSPENDED',
        reason: 'test reason',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
