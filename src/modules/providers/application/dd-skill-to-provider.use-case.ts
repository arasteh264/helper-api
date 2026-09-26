import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import type { SkillRepository } from '../domain/repositories/skill.repository';
import { SKILL_REPOSITORY } from '../domain/repositories/skill.repository.token';

@Injectable()
export class AddSkillToProviderUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(SKILL_REPOSITORY)
    private readonly skillRepository: SkillRepository,
  ) {}

  async execute(userId: string, skillName: string): Promise<void> {
    const profile = await this.providerProfileRepository.findByUserId(userId);

    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const skill = await this.skillRepository.findOrCreateByName(skillName);

    profile.addSkill(skill.id);
    await this.providerProfileRepository.update(profile);
  }
}
