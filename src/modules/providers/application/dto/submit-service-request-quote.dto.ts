import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SubmitServiceRequestQuoteDto {
  @ApiProperty({ description: 'Total proposed price in toman', example: 750000 })
  @IsInt()
  @Min(1)
  proposedPriceToman!: number;

  @ApiProperty({
    description: 'Description and scope of the proposed service',
    example: 'هزینه شامل اجرت و نصب قطعه است.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  quoteNote!: string;

  @ApiPropertyOptional({
    description: 'Estimated hours for hourly specialties',
    example: 2.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(1000)
  estimatedHours?: number;
}
