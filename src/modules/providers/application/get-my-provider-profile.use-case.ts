import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import { ProviderProfileDetailsResponseDto } from './dto/provider-profile-details-response.dto';

@Injectable()
export class GetMyProviderProfileUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(userId: string) {
    const details =
      await this.providerProfileRepository.findDetailsByUserId(userId);
    if (!details) throw new NotFoundException('Provider profile not found');
    return ProviderProfileDetailsResponseDto.from(details);
  }
}
