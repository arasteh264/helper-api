import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  IsIn,
  MinLength,
} from 'class-validator';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional({ example: 'برقکار با ۱۰ سال سابقه' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 35.7219, minimum: -90, maximum: 90 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  serviceAreaLatitude?: number | null;

  @ApiPropertyOptional({ example: 51.3347, minimum: -180, maximum: 180 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  serviceAreaLongitude?: number | null;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  serviceAreaRadiusKm?: number;

  @ApiPropertyOptional({ example: 'تهران، خیابان نمونه، پلاک ۱۲' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  providerAddress?: string;

  @ApiPropertyOptional({ enum: ['HOME', 'BUSINESS'], example: 'HOME' })
  @IsOptional()
  @IsIn(['HOME', 'BUSINESS'])
  providerAddressType?: 'HOME' | 'BUSINESS';
}
