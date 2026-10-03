export interface SpecialtyResponseDto {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  activeProvidersCount: number;
  pricingMode: 'QUOTE' | 'HOURLY';
  hourlyRateToman: number | null;
  hourlyUnitLabel: string | null;
}

export interface GroupedSpecialtyResponseDto {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  specialties: SpecialtyResponseDto[];
}

export interface SpecialtyGroupSummaryDto {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}
