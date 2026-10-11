import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CompleteProviderOnboardingDto {
  @ApiProperty({ minLength: 64, maxLength: 64 })
  @IsString()
  @Length(64, 64)
  token!: string;

  @ApiProperty({ example: 'نام و نام خانوادگی', minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'provider@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  specialtyIds!: string[];

  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(80, { each: true })
  skills!: string[];

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  providerAddress!: string;

  @ApiProperty({ enum: ['HOME', 'BUSINESS'] })
  @IsIn(['HOME', 'BUSINESS'])
  providerAddressType!: 'HOME' | 'BUSINESS';

  @ApiPropertyOptional({ minimum: -90, maximum: 90, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  serviceAreaLatitude?: number | null;

  @ApiPropertyOptional({ minimum: -180, maximum: 180, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  serviceAreaLongitude?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  serviceAreaRadiusKm?: number;
}
