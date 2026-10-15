import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProviderInvitationDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ example: 'علی رضایی', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'تعمیر پکیج', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;
}
