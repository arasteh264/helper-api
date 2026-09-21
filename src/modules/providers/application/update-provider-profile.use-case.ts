import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import { ProviderProfileDetailsResponseDto } from './dto/provider-profile-details-response.dto';

@Injectable()
export class UpdateProviderProfileUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(userId: string, dto: { bio?: string }) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    if (dto.bio !== undefined) profile.updateBio(dto.bio);
    await this.providerProfileRepository.update(profile);

    const details =
      await this.providerProfileRepository.findDetailsByUserId(userId);
    return ProviderProfileDetailsResponseDto.from(details!);
  }
}