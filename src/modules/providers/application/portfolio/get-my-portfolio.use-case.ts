import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PORTFOLIO_ITEM_REPOSITORY } from '../../domain/repositories/portfolio-item.repository.token';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { PortfolioItemRepository } from '../../domain/repositories/portfolio-item.repository';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';

@Injectable()
export class GetMyPortfolioUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PORTFOLIO_ITEM_REPOSITORY)
    private readonly portfolioItemRepository: PortfolioItemRepository,
  ) {}

  async execute(userId: string) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    return this.portfolioItemRepository.findByProviderProfileId(profile.id);
  }
}
