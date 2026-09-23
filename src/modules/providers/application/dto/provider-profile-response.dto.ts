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

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  verificationStatus!: 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiProperty({ nullable: true })
  verificationNote!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  verifiedAt!: Date | null;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty({ type: [String] })
  skillIds!: string[];

  static fromEntity(profile: ProviderProfile): ProviderProfileResponseDto {
    const dto = new ProviderProfileResponseDto();
    dto.id = profile.id;
    dto.userId = profile.userId;
    dto.bio = profile.bio;
    dto.rating = profile.rating;
    dto.isVerified = profile.isVerified;
    dto.verificationStatus = profile.verificationStatus;
    dto.verificationNote = profile.verificationNote;
    dto.verifiedAt = profile.verifiedAt;
    dto.isAvailable = profile.isAvailable;
    dto.skillIds = profile.skillIds;
    return dto;
  }
}
