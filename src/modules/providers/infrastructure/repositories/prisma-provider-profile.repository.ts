import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';

@Injectable()
export class PrismaProviderProfileRepository implements ProviderProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(profile: ProviderProfile): Promise<void> {
    await this.prisma.providerProfile.create({
      data: {
        id: profile.id,
        userId: profile.userId,
        bio: profile.bio,
        rating: profile.rating,
        isVerified: profile.isVerified,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  }

  async update(profile: ProviderProfile): Promise<void> {
    await this.prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        bio: profile.bio,
        rating: profile.rating,
        isVerified: profile.isVerified,
        updatedAt: profile.updatedAt,
      },
    });

    await this.prisma.providerSkill.deleteMany({
      where: { providerProfileId: profile.id },
    });

    if (profile.skillIds.length > 0) {
      await this.prisma.providerSkill.createMany({
        data: profile.skillIds.map((skillId) => ({
          providerProfileId: profile.id,
          skillId,
        })),
      });
    }
  }

  async findByUserId(userId: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { skills: true },
    });

    if (!profile) {
      return null;
    }

    return ProviderProfile.reconstitute(
      profile.id,
      profile.userId,
      profile.bio,
      profile.rating,
      profile.isVerified,
      profile.skills.map((s) => s.skillId),
      profile.createdAt,
      profile.updatedAt,
    );
  }

  async findById(id: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: { skills: true },
    });

    if (!profile) {
      return null;
    }

    return ProviderProfile.reconstitute(
      profile.id,
      profile.userId,
      profile.bio,
      profile.rating,
      profile.isVerified,
      profile.skills.map((s) => s.skillId),
      profile.createdAt,
      profile.updatedAt,
    );
  }
}