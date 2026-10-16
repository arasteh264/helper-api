import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const PROVIDER_DECLINE_REASONS = [
  'NOT_MY_SPECIALTY',
  'OUT_OF_SERVICE_AREA',
  'SCHEDULE_UNAVAILABLE',
  'REQUEST_DETAILS_INSUFFICIENT',
  'PRICE_OR_BUDGET',
  'OTHER',
] as const;

export type ProviderDeclineReason = (typeof PROVIDER_DECLINE_REASONS)[number];

export class DeclineServiceRequestDto {
  @ApiProperty({ enum: PROVIDER_DECLINE_REASONS })
  @IsIn(PROVIDER_DECLINE_REASONS)
  reason!: ProviderDeclineReason;

  @ApiPropertyOptional({ minLength: 5, maxLength: 500 })
  @ValidateIf((dto: DeclineServiceRequestDto) => dto.reason === 'OTHER')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5, { message: 'برای علت «سایر»، توضیح بیشتری وارد کنید' })
  @MaxLength(500)
  note?: string;
}
