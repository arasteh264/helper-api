import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const prisma = {
    providerProfile: { findUnique: jest.fn() },
    serviceRequest: { findUnique: jest.fn() },
    invoice: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new InvoicesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (transaction: typeof prisma) => unknown) => callback(prisma),
    );
  });

  it('uses the accepted provider and computes each amount and total', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    prisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      customerId: 'customer-1',
      acceptedProviderProfileId: 'profile-1',
    });
    prisma.invoice.create.mockResolvedValue({ id: 'invoice-1' });

    await service.createForRequest('provider-user-1', 'request-1', {
      items: [
        { description: 'Materials', quantity: 2, unitPriceToman: 1200 },
        { description: 'Labor', quantity: 1, unitPriceToman: 800 },
      ],
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceRequestId: 'request-1',
          customerId: 'customer-1',
          providerProfileId: 'profile-1',
          totalToman: 3200,
          items: [
            {
              description: 'Materials',
              quantity: 2,
              unitPriceToman: 1200,
              amountToman: 2400,
            },
            {
              description: 'Labor',
              quantity: 1,
              unitPriceToman: 800,
              amountToman: 800,
            },
          ],
        }),
      }),
    );
  });

  it('rejects providers not assigned to the request', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      id: 'other-profile',
    });
    prisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'request-1',
      customerId: 'customer-1',
      acceptedProviderProfileId: 'profile-1',
    });

    await expect(
      service.createForRequest('provider-user-2', 'request-1', {
        items: [{ description: 'Work', quantity: 1, unitPriceToman: 100 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('does not expose a customer invoice unless it is theirs and sent', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      service.getForCustomer('another-customer', 'invoice-1'),
    ).rejects.toThrow('فاکتور پیدا نشد');
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice-1',
          customerId: 'another-customer',
          status: 'SENT',
        },
      }),
    );
  });

  it('atomically marks an invoice sent and creates its in-app notice', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1',
      serviceRequestId: 'request-1',
      customerId: 'customer-1',
      status: 'DRAFT',
      serviceRequest: { title: 'Repair' },
    });
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ id: 'invoice-1' });
    prisma.notification.create.mockResolvedValue({ id: 'notice-1' });

    await service.sendToCustomer('provider-user-1', 'invoice-1');

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'customer-1',
          invoiceId: 'invoice-1',
          serviceRequestId: 'request-1',
          category: 'PAYMENTS',
          type: 'PAYMENT_UPDATE',
        }),
      }),
    );
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invoice-1',
          providerProfileId: 'profile-1',
          status: 'DRAFT',
        },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('does not re-send an already sent invoice', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'invoice-1',
      status: 'SENT',
    });

    await expect(
      service.sendToCustomer('provider-user-1', 'invoice-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
