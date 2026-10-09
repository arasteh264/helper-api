import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';
import type {
  AdminProviderInsights,
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
        serviceAreaLatitude: profile.serviceAreaLatitude,
        serviceAreaLongitude: profile.serviceAreaLongitude,
        serviceAreaRadiusKm: profile.serviceAreaRadiusKm,
        providerAddress: profile.providerAddress,
        providerAddressType: profile.providerAddressType,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  }

  async update(
    profile: ProviderProfile,
    audit?: {
      actorUserId: string;
      action: string;
      reason: string;
      beforeState: Record<string, string | number | boolean | null>;
      afterState: Record<string, string | number | boolean | null>;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.providerProfile.update({
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
          serviceAreaLatitude: profile.serviceAreaLatitude,
          serviceAreaLongitude: profile.serviceAreaLongitude,
          serviceAreaRadiusKm: profile.serviceAreaRadiusKm,
          providerAddress: profile.providerAddress,
          providerAddressType: profile.providerAddressType,
          updatedAt: profile.updatedAt,
        },
      });
      await tx.providerSkill.deleteMany({
        where: { providerProfileId: profile.id },
      });
      await tx.providerSkill.createMany({
        data: profile.skillIds.map((skillId) => ({
          providerProfileId: profile.id,
          skillId,
        })),
        skipDuplicates: true,
      });
      if (audit) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: audit.actorUserId,
            action: audit.action,
            targetType: 'PROVIDER',
            targetId: profile.id,
            reason: audit.reason,
            beforeState: audit.beforeState,
            afterState: audit.afterState,
          },
        });
      }
    });
  }

  async findByUserId(userId: string): Promise<ProviderProfile | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      include: { skills: true },
    });

    return profile ? this.toDomain(profile) : null;
  }

  async findActiveSpecialtyIds(specialtyIds: string[]): Promise<string[]> {
    if (!specialtyIds.length) return [];

    const specialties = await this.prisma.specialty.findMany({
      where: { id: { in: specialtyIds }, isActive: true },
      select: { id: true },
    });
    return specialties.map((specialty) => specialty.id);
  }

  async replaceSpecialties(
    providerProfileId: string,
    specialtyIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.providerSpecialty.deleteMany({
        where: { providerProfileId },
      }),
      ...(specialtyIds.length
        ? [
            this.prisma.providerSpecialty.createMany({
              data: specialtyIds.map((specialtyId) => ({
                providerProfileId,
                specialtyId,
              })),
            }),
          ]
        : []),
    ]);
  }

  async findAllApproved(): Promise<ProviderProfile[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED' as any,
        user: { status: 'ACTIVE' },
      },
      include: {
        skills: true,
      },
    });

    return rows.map((row) => this.toDomain(row));
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
        user: {
          select: { name: true, email: true, phone: true, status: true },
        },
        skills: { include: { skill: true } },
        specialties: { include: { specialty: { include: { group: true } } } },
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      userId: p.userId,
      bio: p.bio,
      rating: p.rating,
      isVerified: p.isVerified,
      verificationStatus: p.verificationStatus,
      verificationNote: p.verificationNote,
      verifiedAt: p.verifiedAt,
      isAvailable: p.isAvailable,
      avatarUrl: p.avatarUrl,
      serviceAreaLatitude: p.serviceAreaLatitude,
      serviceAreaLongitude: p.serviceAreaLongitude,
      serviceAreaRadiusKm: p.serviceAreaRadiusKm,
      providerAddress: p.providerAddress,
      providerAddressType: p.providerAddressType,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      skills: p.skills.map((s) => ({ id: s.skill.id, name: s.skill.name })),
      specialties: p.specialties.map(({ specialty }) => ({
        id: specialty.id,
        name: specialty.name,
        slug: specialty.slug,
        icon: specialty.icon,
        groupId: specialty.groupId,
        groupName: specialty.group.name,
      })),
    };
  }

  async findMatchingBySkillIds(skillIds: string[]): Promise<ProviderProfile[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED' as any,
        isAvailable: true,
        user: { status: 'ACTIVE' },
        skills: { some: { skillId: { in: skillIds } } },
      },
      include: { skills: true },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findByVerificationStatus(
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<ProviderProfile[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: { verificationStatus: status as any },
      include: { skills: true },
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findPendingDetailsPage(input: {
    skip: number;
    take: number;
    search?: string;
    isAvailable?: boolean;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  }): Promise<{ items: ProviderProfileDetails[]; total: number }> {
    const where = {
      verificationStatus: input.status ?? 'PENDING',
      ...(input.isAvailable === undefined
        ? {}
        : { isAvailable: input.isAvailable }),
      ...(input.search
        ? {
            user: {
              is: {
                OR: [
                  {
                    name: {
                      contains: input.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: input.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    phone: {
                      contains: input.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where,
        skip: input.skip,
        take: input.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: {
            select: { name: true, email: true, phone: true, status: true },
          },
          skills: { include: { skill: true } },
          specialties: { include: { specialty: { include: { group: true } } } },
        },
      }),
      this.prisma.providerProfile.count({ where }),
    ]);

    return {
      items: rows.map((profile) => ({
        id: profile.id,
        userId: profile.userId,
        bio: profile.bio,
        rating: profile.rating,
        isVerified: profile.isVerified,
        verificationStatus: profile.verificationStatus,
        verificationNote: profile.verificationNote,
        verifiedAt: profile.verifiedAt,
        isAvailable: profile.isAvailable,
        avatarUrl: profile.avatarUrl,
        serviceAreaLatitude: profile.serviceAreaLatitude,
        serviceAreaLongitude: profile.serviceAreaLongitude,
        serviceAreaRadiusKm: profile.serviceAreaRadiusKm,
        providerAddress: profile.providerAddress,
        providerAddressType: profile.providerAddressType,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        user: profile.user,
        skills: profile.skills.map(({ skill }) => ({
          id: skill.id,
          name: skill.name,
        })),
        specialties: profile.specialties.map(({ specialty }) => ({
          id: specialty.id,
          name: specialty.name,
          slug: specialty.slug,
          icon: specialty.icon,
          groupId: specialty.groupId,
          groupName: specialty.group.name,
        })),
      })),
      total,
    };
  }

  async getAdminInsights(input: {
    createdFrom: Date;
    createdTo: Date;
    limit: number;
  }): Promise<AdminProviderInsights> {
    const [registrations, topRated, completedGroups] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where: { createdAt: { gte: input.createdFrom, lte: input.createdTo } },
        select: { createdAt: true },
      }),
      this.prisma.providerProfile.findMany({
        where: {
          verificationStatus: 'APPROVED',
          rating: { gt: 0 },
          user: { status: 'ACTIVE' },
        },
        select: {
          id: true,
          rating: true,
          user: { select: { name: true } },
          skills: { select: { skill: { select: { name: true } } } },
        },
        orderBy: [{ rating: 'desc' }, { createdAt: 'asc' }],
        take: input.limit,
      }),
      this.prisma.serviceRequest.groupBy({
        by: ['acceptedProviderProfileId'],
        where: {
          status: 'COMPLETED',
          acceptedProviderProfileId: { not: null },
          acceptedProviderProfile: {
            is: {
              verificationStatus: 'APPROVED',
              user: { is: { status: 'ACTIVE' } },
            },
          },
        },
        _count: { id: true },
        orderBy: [
          { _count: { id: 'desc' } },
          { acceptedProviderProfileId: 'asc' },
        ],
        take: input.limit,
      }),
    ]);

    const completedCounts = new Map(
      completedGroups.flatMap((group) =>
        group.acceptedProviderProfileId
          ? [[group.acceptedProviderProfileId, group._count.id] as const]
          : [],
      ),
    );
    const completedProviderIds = [...completedCounts.keys()];
    const completedProviders = completedProviderIds.length
      ? await this.prisma.providerProfile.findMany({
          where: { id: { in: completedProviderIds } },
          select: { id: true, user: { select: { name: true } } },
        })
      : [];
    const namesById = new Map(
      completedProviders.map((provider) => [provider.id, provider.user.name]),
    );

    return {
      registrationDates: registrations.map((provider) => provider.createdAt),
      topRated: topRated.map((provider) => ({
        id: provider.id,
        name: provider.user.name,
        rating: provider.rating,
        skills: provider.skills.map(({ skill }) => skill.name),
      })),
      topCompletedJobs: completedProviderIds.flatMap((id) => {
        const name = namesById.get(id);
        return name
          ? [{ id, name, completedJobs: completedCounts.get(id) ?? 0 }]
          : [];
      }),
    };
  }

  async findAllApprovedDetails(): Promise<ProviderProfileDetails[]> {
    const rows = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED' as any,
        user: { status: 'ACTIVE' },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        skills: {
          include: {
            skill: true,
          },
        },
        specialties: { include: { specialty: { include: { group: true } } } },
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
      serviceAreaLatitude: p.serviceAreaLatitude,
      serviceAreaLongitude: p.serviceAreaLongitude,
      serviceAreaRadiusKm: p.serviceAreaRadiusKm,
      providerAddress: p.providerAddress,
      providerAddressType: p.providerAddressType,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,

      user: p.user,

      skills: p.skills.map((s) => ({
        id: s.skill.id,
        name: s.skill.name,
      })),

      specialties: p.specialties.map(({ specialty }) => ({
        id: specialty.id,
        name: specialty.name,
        slug: specialty.slug,
        icon: specialty.icon,
        groupId: specialty.groupId,
        groupName: specialty.group.name,
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
    serviceAreaLatitude: number | null;
    serviceAreaLongitude: number | null;
    serviceAreaRadiusKm: number;
    providerAddress: string | null;
    providerAddressType: 'HOME' | 'BUSINESS';
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
      profile.verificationStatus as any,
      profile.verificationNote,
      profile.verifiedAt,
      profile.isAvailable,
      profile.skills.map((s) => s.skillId),
      profile.createdAt,
      profile.updatedAt,
      profile.avatarUrl,
      profile.avatarPublicId,
      profile.serviceAreaLatitude,
      profile.serviceAreaLongitude,
      profile.serviceAreaRadiusKm,
      profile.providerAddress,
      profile.providerAddressType,
    );
  }
}
