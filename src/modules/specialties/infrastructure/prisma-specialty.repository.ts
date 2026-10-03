import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ISpecialtyRepository,
  SpecialtyGroupRecord,
  SpecialtyRecord,
  CreateSpecialtyGroupInput,
  UpdateSpecialtyGroupInput,
  CreateSpecialtyInput,
  UpdateSpecialtyInput,
} from '../domain/repositories/specialty.repository';
import { SpecialtyGroupEntity } from '../domain/entities/specialty-group.entity';
import { SpecialtyEntity } from '../domain/entities/specialty.entity';

@Injectable()
export class PrismaSpecialtyRepository implements ISpecialtyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveGroups(): Promise<SpecialtyGroupRecord[]> {
    return this.prisma.specialtyGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findAllGroups(): Promise<SpecialtyGroupRecord[]> {
    return this.prisma.specialtyGroup.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findActiveSpecialtiesByGroupId(
    groupId: string,
  ): Promise<SpecialtyEntity[]> {
    const specialties = await this.prisma.specialty.findMany({
      where: { groupId, isActive: true },
      include: {
        _count: {
          select: {
            providers: {
              where: {
                providerProfile: {
                  verificationStatus: 'APPROVED',
                  isAvailable: true,
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return specialties.map(
      (specialty) =>
        new SpecialtyEntity(
          specialty.id,
          specialty.groupId,
          specialty.name,
          specialty.slug,
          specialty.icon,
          specialty.sortOrder,
          specialty.isActive,
          specialty._count.providers,
        ),
    );
  }

  async findSpecialtiesByGroupId(groupId: string): Promise<SpecialtyRecord[]> {
    return this.prisma.specialty.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findAllGroupedWithActiveProviderCounts(): Promise<
    SpecialtyGroupEntity[]
  > {
    const groups = await this.prisma.specialtyGroup.findMany({
      include: {
        specialties: {
          include: {
            _count: {
              select: {
                providers: {
                  where: {
                    providerProfile: {
                      verificationStatus: 'APPROVED',
                      isAvailable: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return groups.map(
      (group) =>
        new SpecialtyGroupEntity(
          group.id,
          group.name,
          group.slug,
          group.icon,
          group.sortOrder,
          group.isActive,
          group.specialties
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(
              (specialty) =>
                new SpecialtyEntity(
                  specialty.id,
                  specialty.groupId,
                  specialty.name,
                  specialty.slug,
                  specialty.icon,
                  specialty.sortOrder,
                  specialty.isActive,
                  specialty._count.providers,
                  specialty.pricingMode,
                  specialty.hourlyRateToman,
                  specialty.hourlyUnitLabel,
                ),
            ),
        ),
    );
  }

  async findGroupById(id: string): Promise<SpecialtyGroupRecord | null> {
    return this.prisma.specialtyGroup.findUnique({ where: { id } });
  }

  async findGroupBySlug(slug: string): Promise<SpecialtyGroupRecord | null> {
    return this.prisma.specialtyGroup.findUnique({ where: { slug } });
  }

  async countSpecialtiesInGroup(groupId: string): Promise<number> {
    return this.prisma.specialty.count({ where: { groupId } });
  }

  async createGroup(
    input: CreateSpecialtyGroupInput,
  ): Promise<SpecialtyGroupRecord> {
    return this.prisma.specialtyGroup.create({
      data: {
        name: input.name,
        slug: input.slug,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        icon: input.icon ?? null,
        iconPublicId: input.iconPublicId ?? null,
      },
    });
  }

  async updateGroup(
    id: string,
    input: UpdateSpecialtyGroupInput,
  ): Promise<SpecialtyGroupRecord> {
    return this.prisma.specialtyGroup.update({
      where: { id },
      data: input,
    });
  }

  async deleteGroup(id: string): Promise<void> {
    await this.prisma.specialtyGroup.delete({ where: { id } });
  }

  async findSpecialtyById(id: string): Promise<SpecialtyRecord | null> {
    return this.prisma.specialty.findUnique({ where: { id } });
  }

  async findSpecialtyBySlug(slug: string): Promise<SpecialtyRecord | null> {
    return this.prisma.specialty.findUnique({ where: { slug } });
  }

  async countProvidersForSpecialty(specialtyId: string): Promise<number> {
    return this.prisma.providerSpecialty.count({ where: { specialtyId } });
  }

  async createSpecialty(input: CreateSpecialtyInput): Promise<SpecialtyRecord> {
    return this.prisma.specialty.create({
      data: {
        groupId: input.groupId,
        name: input.name,
        slug: input.slug,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        icon: input.icon ?? null,
        iconPublicId: input.iconPublicId ?? null,
        pricingMode: input.pricingMode ?? 'QUOTE',
        hourlyRateToman: input.hourlyRateToman ?? null,
        hourlyUnitLabel: input.hourlyUnitLabel ?? null,
      },
    });
  }

  async updateSpecialty(
    id: string,
    input: UpdateSpecialtyInput,
  ): Promise<SpecialtyRecord> {
    return this.prisma.specialty.update({
      where: { id },
      data: input,
    });
  }

  async deleteSpecialty(id: string): Promise<void> {
    await this.prisma.specialty.delete({ where: { id } });
  }
}
