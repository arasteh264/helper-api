import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPayoutRequestDto {
  @ApiProperty({ enum: ['PAID', 'REJECTED'] })
  @IsIn(['PAID', 'REJECTED'])
  decision!: 'PAID' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Required for PAID decisions' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceCode?: string;

  @ApiPropertyOptional({ description: 'Required for REJECTED decisions' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectReason?: string;
}
