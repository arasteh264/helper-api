import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProviderInvitationDto } from './create-provider-invitation.dto';

export class CreateProviderInvitationBatchDto {
  @ApiProperty({ type: [CreateProviderInvitationDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProviderInvitationDto)
  items!: CreateProviderInvitationDto[];
}
