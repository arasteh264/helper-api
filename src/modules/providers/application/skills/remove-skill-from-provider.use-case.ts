import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';


@Injectable()
export class RemoveSkillFromProviderUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(userId: string, skillId: string): Promise<void> {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    profile.removeSkill(skillId);
    await this.providerProfileRepository.update(profile);
  }
}
