import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProviderInvitationDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;
}
