import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateChatMessageDto {
  @ApiProperty({ enum: ['VISIBLE', 'HIDDEN'] })
  @IsIn(['VISIBLE', 'HIDDEN'])
  status!: 'VISIBLE' | 'HIDDEN';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
