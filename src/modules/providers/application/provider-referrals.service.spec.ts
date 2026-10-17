import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
import { ProviderReferralsService } from './provider-referrals.service';

describe('ProviderReferralsService.grantReward', () => {
  const approvedReferral = {
    id: 'referral-1',
    rewardType: null,
    referralCode: { providerProfileId: 'inviter-profile' },
    referredProviderProfile: {
      id: 'invitee-profile',
      verificationStatus: 'APPROVED',
      isVerified: true,
      user: { name: 'متخصص دعوت‌شده' },
    },
  };

  function createFixture(referral = approvedReferral) {
    const transaction = {
      providerReferral: {
        findUnique: jest.fn().mockResolvedValue(referral),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      providerProfile: { update: jest.fn().mockResolvedValue({}) },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (db: typeof transaction) => unknown) => callback(transaction),
      ),
    };
    return {
      service: new ProviderReferralsService(prisma as unknown as PrismaService),
      transaction,
    };
  }

  it('grants the selected publishing permission to the inviter', async () => {
    const { service, transaction } = createFixture();

    await service.grantReward(
      'referral-1',
      'admin-user',
      'ARTICLE_PUBLISHING',
    );

    expect(transaction.providerReferral.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'referral-1', rewardType: null },
        data: expect.objectContaining({
          rewardType: 'ARTICLE_PUBLISHING',
          rewardedAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'inviter-profile' },
      data: { canPublishArticles: true },
    });
    expect(transaction.adminAuditLog.create).toHaveBeenCalled();
  });

  it('requires the referred provider to be fully verified before granting a reward', async () => {
    const { service, transaction } = createFixture({
      ...approvedReferral,
      referredProviderProfile: {
        ...approvedReferral.referredProviderProfile,
        verificationStatus: 'PENDING',
        isVerified: false,
      },
    });

    await expect(
      service.grantReward(
        'referral-1',
        'admin-user',
        'ZERO_COMMISSION',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.providerReferral.updateMany).not.toHaveBeenCalled();
    expect(transaction.providerProfile.update).not.toHaveBeenCalled();
  });
});
