import { SpecialtyGroupEntity } from '../entities/specialty-group.entity';
import { SpecialtyEntity } from '../entities/specialty.entity';

export interface SpecialtyGroupRecord {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  iconPublicId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SpecialtyRecord {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  icon: string | null;
  iconPublicId: string | null;
  sortOrder: number;
  isActive: boolean;
  pricingMode: 'QUOTE' | 'HOURLY';
  hourlyRateToman: number | null;
  hourlyUnitLabel: string | null;
}

export interface CreateSpecialtyGroupInput {
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
  icon?: string | null;
  iconPublicId?: string | null;
}

export interface UpdateSpecialtyGroupInput {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
  icon?: string | null;
  iconPublicId?: string | null;
}

export interface CreateSpecialtyInput {
  groupId: string;
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
  icon?: string | null;
  iconPublicId?: string | null;
  pricingMode?: 'QUOTE' | 'HOURLY';
  hourlyRateToman?: number | null;
  hourlyUnitLabel?: string | null;
}

export interface UpdateSpecialtyInput {
  groupId?: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
  icon?: string | null;
  iconPublicId?: string | null;
  pricingMode?: 'QUOTE' | 'HOURLY';
  hourlyRateToman?: number | null;
  hourlyUnitLabel?: string | null;
}

export interface ISpecialtyRepository {
  findActiveGroups(): Promise<SpecialtyGroupRecord[]>;
  findAllGroups(): Promise<SpecialtyGroupRecord[]>;
  findActiveSpecialtiesByGroupId(groupId: string): Promise<SpecialtyEntity[]>;
  findSpecialtiesByGroupId(groupId: string): Promise<SpecialtyRecord[]>;
  findAllGroupedWithActiveProviderCounts(): Promise<SpecialtyGroupEntity[]>;

  findGroupById(id: string): Promise<SpecialtyGroupRecord | null>;
  findGroupBySlug(slug: string): Promise<SpecialtyGroupRecord | null>;
  countSpecialtiesInGroup(groupId: string): Promise<number>;
  createGroup(input: CreateSpecialtyGroupInput): Promise<SpecialtyGroupRecord>;
  updateGroup(
    id: string,
    input: UpdateSpecialtyGroupInput,
  ): Promise<SpecialtyGroupRecord>;
  deleteGroup(id: string): Promise<void>;

  findSpecialtyById(id: string): Promise<SpecialtyRecord | null>;
  findSpecialtyBySlug(slug: string): Promise<SpecialtyRecord | null>;
  countProvidersForSpecialty(specialtyId: string): Promise<number>;
  createSpecialty(input: CreateSpecialtyInput): Promise<SpecialtyRecord>;
  updateSpecialty(
    id: string,
    input: UpdateSpecialtyInput,
  ): Promise<SpecialtyRecord>;
  deleteSpecialty(id: string): Promise<void>;
}
