import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    example: 'test@test.com',
    description: 'Unique email address',
  })
  @IsEmail()
  email!: string;

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
