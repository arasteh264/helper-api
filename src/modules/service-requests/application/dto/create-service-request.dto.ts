import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PreferredTime } from '../../domain/entities/preferred-time.enum';

export class CreateServiceRequestDto {
  @ApiProperty({ example: 'تعمیر لوله‌کشی حمام' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    example: 'لوله زیر سینک ظرفشویی نشتی داره و باید سریع تعمیر بشه',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 'لوله‌کشی' })
  @IsString()
  @IsNotEmpty()
  skillName!: string;

  @ApiProperty({ example: 'تهران، گیشا، خیابان کوشک' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @ApiPropertyOptional({ example: 35.7219 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 51.3347 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: PreferredTime })
  @IsOptional()
  @IsEnum(PreferredTime)
  preferredTime?: PreferredTime;

  @ApiPropertyOptional({ example: '2026-10-01T09:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;
}
