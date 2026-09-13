import { ApiProperty } from '@nestjs/swagger';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';

export class ProviderProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  bio!: string | null;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ type: [String] })
  skillIds!: string[];

  static fromEntity(profile: ProviderProfile): ProviderProfileResponseDto {
    const dto = new ProviderProfileResponseDto();
    dto.id = profile.id;
    dto.userId = profile.userId;
    dto.bio = profile.bio;
    dto.rating = profile.rating;
    dto.isVerified = profile.isVerified;
    dto.skillIds = profile.skillIds;
    return dto;
  }
}