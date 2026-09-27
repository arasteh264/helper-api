import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class InviteProviderDto {
  @ApiProperty({ description: 'شناسه پروفایل متخصص منتخب' })
  @IsUUID()
  providerProfileId!: string;
}
