import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ReviewPayoutRequestDto {
  @ApiProperty({ enum: ['PAID', 'REJECTED'] })
  @IsIn(['PAID', 'REJECTED'])
  decision!: 'PAID' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Required for PAID decisions' })
  @ValidateIf((dto: ReviewPayoutRequestDto) => dto.decision === 'PAID')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  referenceCode?: string;

  @ApiPropertyOptional({ description: 'Required for REJECTED decisions' })
  @ValidateIf((dto: ReviewPayoutRequestDto) => dto.decision === 'REJECTED')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  rejectReason?: string;
}
