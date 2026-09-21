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

export class ProviderProfileDetailsResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  isVerified!: boolean;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ type: ProviderUserDto })
  user!: ProviderUserDto;

  @ApiProperty({ type: [ProviderSkillDto] })
  skills!: ProviderSkillDto[];

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
      avatarUrl: d.avatarUrl,
      user: d.user,
      skills: d.skills,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}