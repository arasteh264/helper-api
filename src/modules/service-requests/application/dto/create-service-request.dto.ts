import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceRequestDto {
  @ApiProperty({ example: 'تعمیر لوله‌کشی حمام' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'لوله زیر سینک ظرفشویی نشتی داره و باید سریع تعمیر بشه' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;
}