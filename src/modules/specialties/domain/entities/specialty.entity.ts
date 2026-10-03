export class SpecialtyEntity {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly icon: string | null,
    public readonly sortOrder: number,
    public readonly isActive: boolean,
    public readonly activeProvidersCount: number,
    public readonly pricingMode: 'QUOTE' | 'HOURLY' = 'QUOTE',
    public readonly hourlyRateToman: number | null = null,
    public readonly hourlyUnitLabel: string | null = null,
  ) {}
}
