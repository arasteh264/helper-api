import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  ProviderProfile,
  ProviderWorkingHourSlot,
} from '../../domain/entities/provider-profile.entity';
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
        verificationStatus: profile.verificationStatus as any,
        verificationNote: profile.verificationNote,
        verifiedAt: profile.verifiedAt,
        isAvailable: profile.isAvailable,
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
          verificationStatus: profile.verificationStatus as any,
          verificationNote: profile.verificationNote,
          verifiedAt: profile.verifiedAt,
          isAvailable: profile.isAvailable,
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
      this.prisma.providerWorkingHour.deleteMany({
        where: { providerProfileId: profile.id },
      }),
      ...(profile.workingHours.length
        ? [
            this.prisma.providerWorkingHour.createMany({
              data: profile.workingHours.map((hour) => ({
                providerProfileId: profile.id,
                dayOfWeek: hour.dayOfWeek,
                isActive: hour.isActive,
                startTime: hour.startTime,
                endTime: hour.endTime,
              })),
            }),
          ]
        : []),
    ]);
  }

  async findByUserId(userId: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { skills: true, workingHours: true },
    });

    return profile ? this.toDomain(profile) : null;
  }
async findAllApproved(): Promise<ProviderProfile[]> {
  const rows = await this.prisma.providerProfile.findMany({
    where: {
      verificationStatus: 'APPROVED' as any,
    },
    include: {
      skills: true,
      workingHours: true,
    },
  });

  return rows.map((row) => this.toDomain(row));
}
  async findById(id: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id },
      include: { skills: true, workingHours: true },
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
        workingHours: true,
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      userId: p.userId,
      bio: p.bio,
      rating: p.rating,
      isVerified: p.isVerified,
      verificationStatus: p.verificationStatus as any,
      verificationNote: p.verificationNote,
      verifiedAt: p.verifiedAt,
      isAvailable: p.isAvailable,
      avatarUrl: p.avatarUrl,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      skills: p.skills.map((s) => ({ id: s.skill.id, name: s.skill.name })),
      workingHours: p.workingHours.map((hour) => ({
        dayOfWeek: hour.dayOfWeek,
        isActive: hour.isActive,
        startTime: hour.startTime,
        endTime: hour.endTime,
      })),
    };
  }

  async findMatchingBySkillIds(skillIds: string[]): Promise<ProviderProfile[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED' as any,
        isAvailable: true,
        skills: { some: { skillId: { in: skillIds } } },
      },
      include: { skills: true, workingHours: true },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findByVerificationStatus(
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<ProviderProfile[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: { verificationStatus: status as any },
      include: { skills: true, workingHours: true },
    });

    return rows.map((row) => this.toDomain(row));
  }

async findAllApprovedDetails(): Promise<ProviderProfileDetails[]> {
  const rows = await this.prisma.providerProfile.findMany({
    where: {
      verificationStatus: 'APPROVED' as any,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      skills: {
        include: {
          skill: true,
        },
      },
      workingHours: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return rows.map((p) => ({
    id: p.id,
    userId: p.userId,
    bio: p.bio,
    rating: p.rating,
    isVerified: p.isVerified,
    verificationStatus: p.verificationStatus as any,
    verificationNote: p.verificationNote,
    verifiedAt: p.verifiedAt,
    isAvailable: p.isAvailable,
    avatarUrl: p.avatarUrl,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,

    user: p.user,

    skills: p.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),

    workingHours: p.workingHours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      isActive: hour.isActive,
      startTime: hour.startTime,
      endTime: hour.endTime,
    })),
  }));
}

  private toDomain(profile: {
    id: string;
    userId: string;
    bio: string | null;
    rating: number;
    isVerified: boolean;
    verificationStatus: string;
    verificationNote: string | null;
    verifiedAt: Date | null;
    isAvailable: boolean;
    avatarUrl: string | null;
    avatarPublicId: string | null;
    createdAt: Date;
    updatedAt: Date;
    skills: { skillId: string }[];
    workingHours: {
      dayOfWeek: number;
      isActive: boolean;
      startTime: string;
      endTime: string;
    }[];
  }): ProviderProfile {
    return ProviderProfile.reconstitute(
      profile.id,
      profile.userId,
      profile.bio,
      profile.rating,
      profile.isVerified,
      profile.verificationStatus as any,
      profile.verificationNote,
      profile.verifiedAt,
      profile.isAvailable,
      profile.skills.map((s) => s.skillId),
      profile.workingHours.map(
        (hour) =>
          ({
            dayOfWeek: hour.dayOfWeek,
            isActive: hour.isActive,
            startTime: hour.startTime,
            endTime: hour.endTime,
          }) as ProviderWorkingHourSlot,
      ),
      profile.createdAt,
      profile.updatedAt,
      profile.avatarUrl,
      profile.avatarPublicId,
    );
  }
}
