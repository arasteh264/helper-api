import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum QuoteItemSupplyMode {
  CUSTOMER = 'CUSTOMER',
  PROVIDER_SEPARATE = 'PROVIDER_SEPARATE',
  PROVIDER_INCLUDED = 'PROVIDER_INCLUDED',
}

export class ServiceRequestQuoteItemDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ minimum: 0, description: 'Total item amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountToman!: number;

  @ApiProperty({ enum: QuoteItemSupplyMode })
  @IsEnum(QuoteItemSupplyMode)
  supplyMode!: QuoteItemSupplyMode;
}

export class SubmitServiceRequestQuoteDto {
  @ApiProperty({ minimum: 1, description: 'Labor amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  proposedPriceToman!: number;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  quoteNote!: string;

  @ApiPropertyOptional({ minimum: 0.25, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(1000)
  estimatedHours?: number;

  @ApiPropertyOptional({ type: [ServiceRequestQuoteItemDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ServiceRequestQuoteItemDto)
  items?: ServiceRequestQuoteItemDto[];
}
