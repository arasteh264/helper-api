import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SelectServiceRequestOfferDto {
  @ApiProperty()
  @IsUUID()
  providerProfileId!: string;
}
