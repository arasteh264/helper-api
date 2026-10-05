import { ForbiddenException } from '@nestjs/common';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { CustomerWalletPaymentsController } from './payments.controller';

describe('CustomerWalletPaymentsController buyer access', () => {
  const paymentsService = {
    getCustomerWallet: jest.fn().mockResolvedValue({ balance: 100000 }),
    createCustomerWalletTopup: jest
      .fn()
      .mockResolvedValue({ paymentUrl: 'https://gateway.test/pay' }),
  };
  const controller = new CustomerWalletPaymentsController(
    paymentsService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it.each(['CUSTOMER', 'PROVIDER'] as const)(
    'allows %s accounts to use the buyer wallet',
    async (role) => {
      const user = { userId: 'buyer-1', role } as TokenPayload;

      await controller.getWallet(user);
      await controller.createTopup(user, { amountToman: 200000 });

      expect(paymentsService.getCustomerWallet).toHaveBeenCalledWith('buyer-1');
      expect(paymentsService.createCustomerWalletTopup).toHaveBeenCalledWith(
        'buyer-1',
        200000,
      );
    },
  );

  it('does not grant buyer-wallet access to admins', () => {
    const admin = { userId: 'admin-1', role: 'ADMIN' } as TokenPayload;

    expect(() => controller.getWallet(admin)).toThrow(ForbiddenException);
    expect(() =>
      controller.createTopup(admin, { amountToman: 200000 }),
    ).toThrow(ForbiddenException);
  });
});
