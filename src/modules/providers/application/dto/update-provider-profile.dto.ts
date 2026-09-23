import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProviderWorkingHourDto {
  @ApiProperty({ example: 6 })
  @IsNumber()
  dayOfWeek: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '21:00' })
  @IsString()
  endTime: string;
}

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

  @ApiPropertyOptional({ type: [ProviderWorkingHourDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderWorkingHourDto)
  workingHours?: ProviderWorkingHourDto[];
}
