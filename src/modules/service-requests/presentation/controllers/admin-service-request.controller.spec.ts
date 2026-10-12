import { BadRequestException } from '@nestjs/common';
import { AdminServiceRequestController } from './admin-service-request.controller';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminServiceRequestController review actions', () => {
  function createController(requestStatus = 'PENDING_ADMIN_REVIEW') {
    const transaction = {
      serviceRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'request-1',
          status: requestStatus,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
      walletConfiguration: { upsert: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
      walletConfiguration: { upsert: jest.fn() },
    };
    const matchProviders = { execute: jest.fn().mockResolvedValue(undefined) };
    const controller = new AdminServiceRequestController(
      {} as never,
      {} as never,
      {} as never,
      prisma as never,
      matchProviders as never,
    );
    return { controller, transaction, matchProviders };
  }

  it('requires a reason when rejecting a request', async () => {
    const { controller } = createController();

    await expect(
      controller.reviewRequest({ userId: 'admin-1' } as never, 'request-1', {
        decision: 'REJECT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves pending requests atomically, records the action, and starts matching', async () => {
    const { controller, transaction, matchProviders } = createController();

    await expect(
      controller.reviewRequest({ userId: 'admin-1' } as never, 'request-1', {
        decision: 'APPROVE',
      }),
    ).resolves.toEqual({
      id: 'request-1',
      status: 'OPEN',
      note: null,
    });
    expect(transaction.serviceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', status: 'PENDING_ADMIN_REVIEW' },
      data: { status: 'OPEN', adminReviewNote: null },
    });
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-1',
        action: 'SERVICE_REQUEST_APPROVED',
        targetType: 'SERVICE_REQUEST',
        targetId: 'request-1',
        reason: 'تأیید درخواست',
        beforeState: { status: 'PENDING_ADMIN_REVIEW' },
        afterState: { status: 'OPEN', note: null },
      },
    });
    expect(matchProviders.execute).toHaveBeenCalledWith('request-1');
  });
});
