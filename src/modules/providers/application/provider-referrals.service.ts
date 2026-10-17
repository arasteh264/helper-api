import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProviderReferralRewardType } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

function prismaCode(error: unknown): string | undefined {
  return (error as { code?: string })?.code;
}

@Injectable()
export class ProviderReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const profile = await this.getProfile(userId);
    const referralCode = await this.prisma.providerReferralCode.findUnique({
      where: { providerProfileId: profile.id },
    });
    const referrals = referralCode
      ? await this.prisma.providerReferral.findMany({
          where: { referralCodeId: referralCode.id },
          include: {
            referredProviderProfile: {
              select: {
                verificationStatus: true,
                isVerified: true,
                user: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      code: referralCode?.code ?? null,
      referrals: referrals.map((referral) => ({
        id: referral.id,
        providerName: referral.referredProviderProfile.user.name,
        verificationStatus:
          referral.referredProviderProfile.verificationStatus,
        isVerified: referral.referredProviderProfile.isVerified,
        rewardType: referral.rewardType,
        rewardedAt: referral.rewardedAt?.toISOString() ?? null,
        createdAt: referral.createdAt.toISOString(),
      })),
    };
  }

  async createOrGetCode(userId: string) {
    const profile = await this.getProfile(userId);
    const existing = await this.prisma.providerReferralCode.findUnique({
      where: { providerProfileId: profile.id },
    });
    if (existing) return { code: existing.code };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const created = await this.prisma.providerReferralCode.create({
          data: {
            providerProfileId: profile.id,
            code: randomBytes(5).toString('hex').toUpperCase(),
          },
        });
        return { code: created.code };
      } catch (error) {
        if (prismaCode(error) !== 'P2002') throw error;
        const concurrentlyCreated =
          await this.prisma.providerReferralCode.findUnique({
            where: { providerProfileId: profile.id },
          });
        if (concurrentlyCreated) return { code: concurrentlyCreated.code };
      }
    }

    throw new ConflictException('ساخت کد دعوت انجام نشد؛ دوباره تلاش کنید');
  }

  async validateCode(userId: string, code: string) {
    const normalizedCode = this.normalizeCode(code);
    const referralCode = await this.prisma.providerReferralCode.findUnique({
      where: { code: normalizedCode },
      select: {
        id: true,
        providerProfile: { select: { id: true, userId: true } },
      },
    });
    if (!referralCode) {
      throw new NotFoundException('کد معرف معتبر نیست');
    }
    if (referralCode.providerProfile.userId === userId) {
      throw new BadRequestException('نمی‌توانید از کد معرف خودتان استفاده کنید');
    }
    return referralCode;
  }

  async linkReferredProfile(
    referredProviderProfileId: string,
    referralCodeId: string,
  ) {
    const existing = await this.prisma.providerReferral.findUnique({
      where: { referredProviderProfileId },
    });
    if (existing) {
      if (existing.referralCodeId === referralCodeId) return existing;
      throw new ConflictException('برای این متخصص قبلاً کد معرف ثبت شده است');
    }

    try {
      return await this.prisma.providerReferral.create({
        data: { referredProviderProfileId, referralCodeId },
      });
    } catch (error) {
      if (prismaCode(error) === 'P2002') {
        throw new ConflictException('برای این متخصص قبلاً کد معرف ثبت شده است');
      }
      throw error;
    }
  }

  async listForAdmin() {
    const referrals = await this.prisma.providerReferral.findMany({
      include: {
        referralCode: {
          include: {
            providerProfile: {
              select: { id: true, user: { select: { name: true, email: true } } },
            },
          },
        },
        referredProviderProfile: {
          select: {
            id: true,
            verificationStatus: true,
            isVerified: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return referrals.map((referral) => ({
      id: referral.id,
      referralCode: referral.referralCode.code,
      referrer: {
        providerProfileId: referral.referralCode.providerProfile.id,
        name: referral.referralCode.providerProfile.user.name,
        email: referral.referralCode.providerProfile.user.email,
      },
      referred: {
        providerProfileId: referral.referredProviderProfile.id,
        name: referral.referredProviderProfile.user.name,
        email: referral.referredProviderProfile.user.email,
        verificationStatus:
          referral.referredProviderProfile.verificationStatus,
        isVerified: referral.referredProviderProfile.isVerified,
      },
      rewardType: referral.rewardType,
      rewardedAt: referral.rewardedAt?.toISOString() ?? null,
      createdAt: referral.createdAt.toISOString(),
    }));
  }

  async grantReward(
    referralId: string,
    adminId: string,
    rewardType: ProviderReferralRewardType,
  ) {
    return this.prisma.$transaction(async (db) => {
      const referral = await db.providerReferral.findUnique({
        where: { id: referralId },
        include: {
          referralCode: { select: { providerProfileId: true } },
          referredProviderProfile: {
            select: {
              id: true,
              verificationStatus: true,
              isVerified: true,
              user: { select: { name: true } },
            },
          },
        },
      });
      if (!referral) throw new NotFoundException('دعوت پیدا نشد');
      if (
        referral.referredProviderProfile.verificationStatus !== 'APPROVED' ||
        !referral.referredProviderProfile.isVerified
      ) {
        throw new ConflictException(
          'پس از تأیید کامل پروفایل و مدارک متخصص دعوت‌شده می‌توانید جایزه را فعال کنید',
        );
      }
      if (referral.rewardType) {
        throw new ConflictException('برای این دعوت قبلاً جایزه‌ای فعال شده است');
      }

      const updatedReferral = await db.providerReferral.updateMany({
        where: { id: referralId, rewardType: null },
        data: { rewardType, rewardedAt: new Date() },
      });
      if (updatedReferral.count !== 1) {
        throw new ConflictException('این دعوت هم‌زمان توسط مدیر دیگری بررسی شد');
      }

      const accessChanges =
        rewardType === 'STORY_PUBLISHING'
          ? { canPublishStories: true }
          : rewardType === 'ARTICLE_PUBLISHING'
            ? { canPublishArticles: true }
            : { commissionExempt: true };
      await db.providerProfile.update({
        where: { id: referral.referralCode.providerProfileId },
        data: accessChanges,
      });
      await db.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          action: 'PROVIDER_REFERRAL_REWARD_GRANTED',
          targetType: 'ProviderReferral',
          targetId: referralId,
          reason: `Granted ${rewardType} to the referring provider`,
          beforeState: { rewardType: null },
          afterState: {
            rewardType,
            referrerProfileId: referral.referralCode.providerProfileId,
            referredProfileId: referral.referredProviderProfile.id,
          },
        },
      });

      return {
        id: referralId,
        rewardType,
        rewardedAt: new Date().toISOString(),
        referrerProfileId: referral.referralCode.providerProfileId,
        referredProviderName: referral.referredProviderProfile.user.name,
      };
    });
  }

  private async getProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('پروفایل متخصص پیدا نشد');
    return profile;
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-F0-9]{10}$/.test(normalized)) {
      throw new BadRequestException('ساختار کد معرف معتبر نیست');
    }
    return normalized;
  }
}
