import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined, ValidateNested } from 'class-validator';

class NotificationChannelPreferenceDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  inApp!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  sms!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  email!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: NotificationChannelPreferenceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  messages!: NotificationChannelPreferenceDto;

  @ApiProperty({ type: NotificationChannelPreferenceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  workUpdates!: NotificationChannelPreferenceDto;

  @ApiProperty({ type: NotificationChannelPreferenceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  opportunities!: NotificationChannelPreferenceDto;

  @ApiProperty({ type: NotificationChannelPreferenceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  payments!: NotificationChannelPreferenceDto;

  @ApiProperty({ type: NotificationChannelPreferenceDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationChannelPreferenceDto)
  promotions!: NotificationChannelPreferenceDto;
}
