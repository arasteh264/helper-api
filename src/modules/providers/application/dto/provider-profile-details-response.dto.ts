import { ApiProperty } from '@nestjs/swagger';
import type { ProviderProfileDetails } from '../../domain/repositories/provider-profile.repository';

class ProviderUserDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  status!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

class ProviderSkillDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

class ProviderSpecialtyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true, type: String })
  icon!: string | null;

  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  groupName!: string;
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

  @ApiProperty({ nullable: true, type: Number })
  serviceAreaLatitude!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  serviceAreaLongitude!: number | null;

  @ApiProperty({ minimum: 1, maximum: 200 })
  serviceAreaRadiusKm!: number;

  @ApiProperty({ type: ProviderUserDto })
  user!: ProviderUserDto;

  @ApiProperty({ type: [ProviderSkillDto] })
  skills!: ProviderSkillDto[];

  @ApiProperty({ type: [ProviderSpecialtyDto] })
  specialties!: ProviderSpecialtyDto[];

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
      serviceAreaLatitude: d.serviceAreaLatitude,
      serviceAreaLongitude: d.serviceAreaLongitude,
      serviceAreaRadiusKm: d.serviceAreaRadiusKm,
      user: d.user,
      skills: d.skills,
      specialties: d.specialties,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
