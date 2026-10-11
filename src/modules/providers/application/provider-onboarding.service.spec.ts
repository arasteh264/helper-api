import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { PasswordHasher } from '../../users/domain/services/password-hasher.port';
import type { TokenGenerator } from '../../auth/domain/services/token-generator.port';
import type { SmsService } from '../../sms/sms.service';
import { ProviderOnboardingService } from './provider-onboarding.service';

jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ProviderOnboardingService', () => {
  const originalEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    onboardingUrl: process.env.PROVIDER_ONBOARDING_URL,
  };

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalEnvironment.nodeEnv;
    process.env.PROVIDER_ONBOARDING_URL = originalEnvironment.onboardingUrl;
  });

  function createService() {
    const invitation = { id: 'invitation-1', expiresAt: new Date() };
    const tx = {
      providerOnboardingInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue(invitation),
      },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
      providerOnboardingInvitation: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    const tokenGenerator = { generate: jest.fn() };
    const smsService = { sendNotification: jest.fn().mockResolvedValue(undefined) };

    return {
      service: new ProviderOnboardingService(
        prisma as unknown as PrismaService,
        passwordHasher as PasswordHasher,
        tokenGenerator as TokenGenerator,
        smsService as unknown as SmsService,
      ),
      prisma,
      tx,
      smsService,
    };
  }

  it('sends a one-time invitation for a normalized Iranian phone number', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PROVIDER_ONBOARDING_URL =
      'https://customer.example.test/provider/onboarding';
    const { service, prisma, tx, smsService } = createService();

    await service.createInvitation('+98 912 123 4567', 'admin-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.providerOnboardingInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '09121234567',
          createdById: 'admin-1',
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(smsService.sendNotification).toHaveBeenCalledWith(
      '09121234567',
      expect.stringContaining('https://customer.example.test/provider/onboarding?token='),
    );

    const storedHash =
      tx.providerOnboardingInvitation.create.mock.calls[0][0].data.tokenHash;
    const message = smsService.sendNotification.mock.calls[0][1];
    const token = new URL(message.split('\n').at(-1)!).searchParams.get('token');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(storedHash).toBe(createHash('sha256').update(token!).digest('hex'));
    expect(storedHash).not.toBe(token);
  });

  it('revokes an invitation if the SMS provider fails', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PROVIDER_ONBOARDING_URL =
      'https://customer.example.test/provider/onboarding';
    const { service, prisma, smsService } = createService();
    smsService.sendNotification.mockRejectedValue(new Error('SMS unavailable'));

    await expect(
      service.createInvitation('09121234567', 'admin-1'),
    ).rejects.toThrow('SMS unavailable');
    expect(prisma.providerOnboardingInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invitation-1' },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects invalid mobile numbers before creating an invitation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createInvitation('12345', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
