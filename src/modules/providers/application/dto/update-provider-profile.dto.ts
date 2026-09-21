import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProviderProfileDto {
  @ApiPropertyOptional({ example: 'برقکار با ۱۰ سال سابقه' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}