import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function normalizeOptionalEmail({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

export class CreateUserDto {
  @ApiProperty({
    example: 'Mohammad Mahdi',
    description: 'Full name of the user',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({
    example: 'test@test.com',
    description: 'Optional email address',
  })
  @Transform(normalizeOptionalEmail)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '09121234567',
    description: 'Unique phone number',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: 'StrongPass123',
    description: 'Password, minimum 8 characters',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
