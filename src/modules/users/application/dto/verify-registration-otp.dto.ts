import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyRegistrationOtpDto {
  @ApiProperty({
    example: '09121234567',
    description: 'Phone number used during registration',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    example: '123456',
    description: 'OTP code sent to the phone number',
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}
