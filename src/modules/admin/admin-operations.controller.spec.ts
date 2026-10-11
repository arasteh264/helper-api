import { AdminOperationsController } from './admin-operations.controller';

jest.mock('../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminOperationsController', () => {
  it('returns paginated audit logs with the requested filter', async () => {
    const items = [{ id: 'audit-1' }];
    const prisma = {
      adminAuditLog: {
        findMany: jest.fn().mockResolvedValue(items),
        count: jest.fn().mockResolvedValue(21),
      },
    };
    const controller = new AdminOperationsController(prisma as never);

    await expect(
      controller.listAuditLogs({
        page: 2,
        pageSize: 10,
        targetType: 'SERVICE_REQUEST',
      }),
    ).resolves.toEqual({
      items,
      total: 21,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetType: 'SERVICE_REQUEST' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('returns operational queue counts with the dashboard response shape', async () => {
    const prisma = {
      providerProfile: { count: jest.fn().mockResolvedValue(2) },
      payoutRequest: { count: jest.fn().mockResolvedValue(1) },
      payment: { count: jest.fn().mockResolvedValue(3) },
      serviceRequest: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(5),
      },
    };
    const controller = new AdminOperationsController(prisma as never);

    const result = await controller.getOperationalAlerts();

    expect(result.items.map(({ key, count }) => [key, count])).toEqual([
      ['pending-providers', 2],
      ['pending-payouts', 1],
      ['stale-payments', 3],
      ['unassigned-requests', 4],
      ['stale-disputes', 5],
    ]);
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(prisma.payment.count).toHaveBeenCalledTimes(1);
  });
});
