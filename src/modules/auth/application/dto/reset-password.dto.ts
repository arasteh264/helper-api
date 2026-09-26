import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3d4...' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
