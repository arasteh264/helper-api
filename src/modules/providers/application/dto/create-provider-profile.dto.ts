import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProviderProfileDto {
  @ApiProperty({
    required: false,
    example: 'تعمیرکار حرفه‌ای با ۵ سال سابقه در تعمیر لوازم خانگی',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({
    required: false,
    example: 'A1B2C3D4E5',
    description: 'Optional referral code from another provider',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}
