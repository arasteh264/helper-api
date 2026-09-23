import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldStrongPass123' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'NewStrongPass456' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Za-z]/, { message: 'newPassword must contain at least one letter' })
  @Matches(/\d/, { message: 'newPassword must contain at least one number' })
  newPassword!: string;
}