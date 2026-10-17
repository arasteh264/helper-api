import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const PROVIDER_CANCELLATION_REASONS = [
  'PROJECT_NOT_FOUND',
  'CUSTOMER_UNAVAILABLE',
  'ACCESS_ISSUE',
  'SCOPE_MISMATCH',
  'SAFETY_CONCERN',
  'OTHER',
] as const;

export type ProviderCancellationReason =
  (typeof PROVIDER_CANCELLATION_REASONS)[number];

export class RequestServiceCancellationDto {
  @ApiProperty({ enum: PROVIDER_CANCELLATION_REASONS })
  @IsIn(PROVIDER_CANCELLATION_REASONS)
  reason!: ProviderCancellationReason;

  @ApiPropertyOptional({ minLength: 5, maxLength: 500 })
  @ValidateIf(
    (dto: RequestServiceCancellationDto) =>
      dto.note !== undefined || dto.reason === 'OTHER',
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5, { message: 'برای علت «سایر»، توضیح بیشتری وارد کنید' })
  @MaxLength(500)
  note?: string;
}
