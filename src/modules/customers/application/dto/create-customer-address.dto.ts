import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerAddressDto {
  @ApiProperty({ example: 'منزل' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  title!: string;

  @ApiProperty({ enum: ['home', 'work', 'other'] })
  @IsIn(['home', 'work', 'other'])
  type!: 'home' | 'work' | 'other';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  receiverName!: string;

  @ApiProperty({ example: '09123456789' })
  @Matches(/^09\d{9}$/)
  receiverPhone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  fullAddress!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  plaque!: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @ApiProperty()
  @Matches(/^\d{10}$/)
  postalCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  title?: string;

  @ApiPropertyOptional({ enum: ['home', 'work', 'other'] })
  @IsOptional()
  @IsIn(['home', 'work', 'other'])
  type?: 'home' | 'work' | 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  receiverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^09\d{9}$/)
  receiverPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  fullAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  plaque?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{10}$/)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
