import { ApiProperty } from '@nestjs/swagger';
import type { ProviderProfileDetails } from '../../domain/repositories/provider-profile.repository';
import { ProviderProfileDetailsResponseDto } from './provider-profile-details-response.dto';

export class ProviderPrivateProfileDetailsResponseDto extends ProviderProfileDetailsResponseDto {
  @ApiProperty({ nullable: true, type: String })
  providerAddress!: string | null;

  @ApiProperty({ enum: ['HOME', 'BUSINESS'] })
  providerAddressType!: 'HOME' | 'BUSINESS';

  static from(
    details: ProviderProfileDetails,
  ): ProviderPrivateProfileDetailsResponseDto {
    return Object.assign(ProviderProfileDetailsResponseDto.from(details), {
      providerAddress: details.providerAddress,
      providerAddressType: details.providerAddressType,
    });
  }
}
