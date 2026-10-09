import { AdminOperationsController } from './admin-operations.controller';

jest.mock('../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminOperationsController', () => {
  it('returns operational queues with the configured age cutoffs', async () => {
    const prisma = {
      adminAuditLog: { findMany: jest.fn(), count: jest.fn() },
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
    expect(prisma.payment.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'PENDING',
        createdAt: { lte: expect.any(Date) },
      }),
    });
  });

  it('exports formula-safe CSV without including bank account numbers', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: '=1+1',
            email: 'user@example.test',
            phone: '09120000000',
            role: 'CUSTOMER',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
        ]),
      },
    };
    const response = { setHeader: jest.fn() };
    const controller = new AdminOperationsController(prisma as never);

    const csv = await controller.exportCsv(
      { type: 'users' },
      response as never,
    );

    expect(csv).toContain('"\'=1+1"');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Export-Truncated',
      'false',
    );
  });
});
