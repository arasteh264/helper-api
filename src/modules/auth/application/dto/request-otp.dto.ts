import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @IsNotEmpty()
  phone!: string;
}
