import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSkillToRequestDto {
  @ApiProperty({ example: 'لوله‌کشی' })
  @IsString()
  @IsNotEmpty()
  skillName!: string;
}
