import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSkillDto {
  @ApiProperty({ example: 'لوله‌کشی' })
  @IsString()
  @IsNotEmpty()
  skillName!: string;
}