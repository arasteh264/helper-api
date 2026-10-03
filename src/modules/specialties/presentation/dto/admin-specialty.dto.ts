import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}

function toInt(value: unknown): number | undefined {
  if (value === undefined || value === '') return undefined;
  return Number(value);
}

export class CreateSpecialtyGroupDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  icon?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSpecialtyGroupDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  icon?: string;

  @ApiPropertyOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSpecialtyDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  icon?: string;

  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional({ enum: ['QUOTE', 'HOURLY'], default: 'QUOTE' })
  @IsOptional()
  @IsIn(['QUOTE', 'HOURLY'])
  pricingMode?: 'QUOTE' | 'HOURLY';

  @ApiPropertyOptional({ minimum: 1, description: 'Hourly rate in toman' })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  hourlyRateToman?: number;

  @ApiPropertyOptional({ maxLength: 30, example: 'ساعت' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  hourlyUnitLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSpecialtyDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  icon?: string;

  @ApiPropertyOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ enum: ['QUOTE', 'HOURLY'] })
  @IsOptional()
  @IsIn(['QUOTE', 'HOURLY'])
  pricingMode?: 'QUOTE' | 'HOURLY';

  @ApiPropertyOptional({ minimum: 1, description: 'Hourly rate in toman' })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  hourlyRateToman?: number;

  @ApiPropertyOptional({ maxLength: 30, example: 'ساعت' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  hourlyUnitLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}
