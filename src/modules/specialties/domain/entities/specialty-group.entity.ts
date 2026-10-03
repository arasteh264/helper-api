import { SpecialtyEntity } from './specialty.entity';

export class SpecialtyGroupEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly icon: string | null,
    public readonly sortOrder: number,
    public readonly isActive: boolean,
    public readonly specialties: SpecialtyEntity[],
  ) {}
}