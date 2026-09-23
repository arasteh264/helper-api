import { ApiProperty } from '@nestjs/swagger';
import type { ProviderProfileDetails } from '../../domain/repositories/provider-profile.repository';

class ProviderUserDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;
}

class ProviderSkillDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

class ProviderWorkingHourDto {
  @ApiProperty()
  dayOfWeek!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;
}

export class ProviderProfileDetailsResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  verificationStatus!: 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiProperty({ nullable: true, type: String })
  verificationNote!: string | null;

  @ApiProperty({ nullable: true, type: Date })
  verifiedAt!: Date | null;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ type: ProviderUserDto })
  user!: ProviderUserDto;

  @ApiProperty({ type: [ProviderSkillDto] })
  skills!: ProviderSkillDto[];

  @ApiProperty({ type: [ProviderWorkingHourDto] })
  workingHours!: ProviderWorkingHourDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static from(d: ProviderProfileDetails): ProviderProfileDetailsResponseDto {
    return {
      id: d.id,
      bio: d.bio,
      rating: d.rating,
      isVerified: d.isVerified,
      verificationStatus: d.verificationStatus,
      verificationNote: d.verificationNote,
      verifiedAt: d.verifiedAt,
      isAvailable: d.isAvailable,
      avatarUrl: d.avatarUrl,
      user: d.user,
      skills: d.skills,
      workingHours: d.workingHours,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
