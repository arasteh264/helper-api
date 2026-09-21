import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';
import type {
  ProviderProfileRepository,
  ProviderProfileDetails,
} from '../../domain/repositories/provider-profile.repository';

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
        avatarUrl: profile.avatarUrl,
        avatarPublicId: profile.avatarPublicId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  }

  async update(profile: ProviderProfile): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.providerProfile.update({
        where: { id: profile.id },
        data: {
          bio: profile.bio,
          rating: profile.rating,
          isVerified: profile.isVerified,
          avatarUrl: profile.avatarUrl,
          avatarPublicId: profile.avatarPublicId,
          updatedAt: profile.updatedAt,
        },
      }),
      this.prisma.providerSkill.deleteMany({
        where: { providerProfileId: profile.id },
      }),
      this.prisma.providerSkill.createMany({
        data: profile.skillIds.map((skillId) => ({
          providerProfileId: profile.id,
          skillId,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  async findByUserId(userId: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { skills: true },
    });

    return profile ? this.toDomain(profile) : null;
  }

  async findById(id: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: { skills: true },
    });

    return profile ? this.toDomain(profile) : null;
  }

  async findDetailsByUserId(
    userId: string,
  ): Promise<ProviderProfileDetails | null> {
    const p = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        skills: { include: { skill: true } },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      userId: p.userId,
      bio: p.bio,
      rating: p.rating,
      isVerified: p.isVerified,
      avatarUrl: p.avatarUrl,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      skills: p.skills.map((s) => ({ id: s.skill.id, name: s.skill.name })),
    };
  }

  private toDomain(profile: {
    id: string;
    userId: string;
    bio: string | null;
    rating: number;
    isVerified: boolean;
    avatarUrl: string | null;
    avatarPublicId: string | null;
    createdAt: Date;
    updatedAt: Date;
    skills: { skillId: string }[];
  }): ProviderProfile {
    return ProviderProfile.reconstitute(
      profile.id,
      profile.userId,
      profile.bio,
      profile.rating,
      profile.isVerified,
      profile.skills.map((s) => s.skillId),
      profile.createdAt,
      profile.updatedAt,
      profile.avatarUrl,
      profile.avatarPublicId,
    );
  }
}