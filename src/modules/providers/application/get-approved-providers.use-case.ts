import { Inject, Injectable } from '@nestjs/common';

import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';

import { ProviderProfileDetailsResponseDto } from './dto/provider-profile-details-response.dto';

@Injectable()
export class GetApprovedProvidersUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute() {
    const providers =
      await this.providerProfileRepository.findAllApprovedDetails();

    return providers.map((provider) =>
      ProviderProfileDetailsResponseDto.from(provider),
    );
  }
}
