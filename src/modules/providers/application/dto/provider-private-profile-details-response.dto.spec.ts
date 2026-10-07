import type { ProviderProfileDetails } from '../../domain/repositories/provider-profile.repository';
import { ProviderPrivateProfileDetailsResponseDto } from './provider-private-profile-details-response.dto';
import { ProviderProfileDetailsResponseDto } from './provider-profile-details-response.dto';

describe('provider profile address visibility', () => {
  const details = {
    id: 'provider-id',
    userId: 'user-id',
    bio: null,
    rating: 0,
    isVerified: false,
    verificationStatus: 'PENDING',
    verificationNote: null,
    verifiedAt: null,
    isAvailable: false,
    avatarUrl: null,
    serviceAreaLatitude: null,
    serviceAreaLongitude: null,
    serviceAreaRadiusKm: 10,
    providerAddress: 'نشانی خصوصی متخصص',
    providerAddressType: 'HOME',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { name: 'Provider', email: 'provider@example.com', phone: '09120000000' },
    skills: [],
    specialties: [],
  } satisfies ProviderProfileDetails;

  it('returns the address in private profile responses only', () => {
    expect(ProviderPrivateProfileDetailsResponseDto.from(details)).toMatchObject({
      providerAddress: 'نشانی خصوصی متخصص',
      providerAddressType: 'HOME',
    });
    expect(ProviderProfileDetailsResponseDto.from(details)).not.toHaveProperty(
      'providerAddress',
    );
  });
});
