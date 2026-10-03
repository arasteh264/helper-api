import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SPECIALTY_REPOSITORY } from '../domain/repositories/specialty.repository.token';
import type { ISpecialtyRepository } from '../domain/repositories/specialty.repository';
import { SpecialtyGroupEntity } from '../domain/entities/specialty-group.entity';
import { SpecialtyEntity } from '../domain/entities/specialty.entity';
import { normalizePersian } from './utils/persian-normalize.util';
import {
  GroupedSpecialtyResponseDto,
  SpecialtyGroupSummaryDto,
  SpecialtyResponseDto,
} from './dto/grouped-specialties-response.dto';

export interface GetGroupedSpecialtiesInput {
  search?: string;
}

@Injectable()
export class GetGroupedSpecialtiesUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
  ) {}

  async getActiveGroups(): Promise<SpecialtyGroupSummaryDto[]> {
    const groups = await this.specialtyRepository.findActiveGroups();
    return groups.map(({ id, name, slug, icon }) => ({
      id,
      name,
      slug,
      icon,
    }));
  }

  async getSpecialtiesByGroupId(
    groupId: string,
  ): Promise<SpecialtyResponseDto[]> {
    const group = await this.specialtyRepository.findGroupById(groupId);
    if (!group || !group.isActive) {
      throw new NotFoundException('گروه تخصصی یافت نشد');
    }

    const specialties =
      await this.specialtyRepository.findActiveSpecialtiesByGroupId(groupId);
    return specialties.map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
      slug: specialty.slug,
      icon: specialty.icon,
      activeProvidersCount: specialty.activeProvidersCount,
      pricingMode: specialty.pricingMode,
      hourlyRateToman: specialty.hourlyRateToman,
      hourlyUnitLabel: specialty.hourlyUnitLabel,
    }));
  }

  async getAdminGroups() {
    const groups = await this.specialtyRepository.findAllGroups();
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      icon: group.icon,
      sortOrder: group.sortOrder,
      isActive: group.isActive,
    }));
  }

  async getAdminSpecialtiesByGroupId(groupId: string) {
    const group = await this.specialtyRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('گروه تخصصی یافت نشد');
    }

    const specialties =
      await this.specialtyRepository.findSpecialtiesByGroupId(groupId);
    return specialties.map(
      ({
        id,
        groupId,
        name,
        slug,
        icon,
        pricingMode,
        hourlyRateToman,
        hourlyUnitLabel,
        sortOrder,
        isActive,
      }) => ({
        id,
        groupId,
        name,
        slug,
        icon,
        pricingMode,
        hourlyRateToman,
        hourlyUnitLabel,
        sortOrder,
        isActive,
      }),
    );
  }

  async execute(
    input: GetGroupedSpecialtiesInput,
  ): Promise<GroupedSpecialtyResponseDto[]> {
    const groups =
      await this.specialtyRepository.findAllGroupedWithActiveProviderCounts();

    return this.filterGroups(groups, input.search)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => this.toDto(group));
  }

  private filterGroups(
    groups: SpecialtyGroupEntity[],
    rawSearch: string | undefined,
  ): SpecialtyGroupEntity[] {
    const activeGroups = groups.filter((group) => group.isActive);
    const search = rawSearch ? normalizePersian(rawSearch) : '';

    if (!search) {
      return activeGroups.map((group) =>
        this.cloneGroup(
          group,
          group.specialties.filter((s) => s.isActive),
        ),
      );
    }

    const result: SpecialtyGroupEntity[] = [];

    for (const group of activeGroups) {
      const activeSpecialties = group.specialties.filter((s) => s.isActive);
      const normalizedGroupName = normalizePersian(group.name);

      if (normalizedGroupName.includes(search)) {
        result.push(this.cloneGroup(group, activeSpecialties));
        continue;
      }

      const matchingSpecialties = activeSpecialties.filter((specialty) =>
        normalizePersian(specialty.name).includes(search),
      );

      if (matchingSpecialties.length > 0) {
        result.push(this.cloneGroup(group, matchingSpecialties));
      }
    }

    return result;
  }

  private cloneGroup(
    group: SpecialtyGroupEntity,
    specialties: SpecialtyEntity[],
  ): SpecialtyGroupEntity {
    return new SpecialtyGroupEntity(
      group.id,
      group.name,
      group.slug,
      group.icon,
      group.sortOrder,
      group.isActive,
      [...specialties].sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  private toDto(group: SpecialtyGroupEntity): GroupedSpecialtyResponseDto {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      icon: group.icon,
      specialties: group.specialties.map((specialty) => ({
        id: specialty.id,
        name: specialty.name,
        slug: specialty.slug,
        icon: specialty.icon,
        activeProvidersCount: specialty.activeProvidersCount,
        pricingMode: specialty.pricingMode,
        hourlyRateToman: specialty.hourlyRateToman,
        hourlyUnitLabel: specialty.hourlyUnitLabel,
      })),
    };
  }
}
