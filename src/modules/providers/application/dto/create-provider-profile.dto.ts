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
}
