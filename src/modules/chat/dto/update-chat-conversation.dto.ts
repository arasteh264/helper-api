import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateChatConversationDto {
  @ApiProperty({ enum: ['ACTIVE', 'PAUSED', 'CLOSED'] })
  @IsIn(['ACTIVE', 'PAUSED', 'CLOSED'])
  status!: 'ACTIVE' | 'PAUSED' | 'CLOSED';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pausedReason?: string;
}
