import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import * as userRepository from '../../../users/domain/repositories/user.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository.token';
import { ProviderProfile } from '../../domain/entities/provider-profile.entity';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { UserRole } from '../../../users/domain/entities/user-role.enum';
@Injectable()
export class CreateProviderProfileUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
  ) {}

  async execute(userId: string, bio: string | null): Promise<ProviderProfile> {
    const existing = await this.providerProfileRepository.findByUserId(userId);
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (existing) {
      if (user.role !== UserRole.PROVIDER) {
        user.setRole(UserRole.PROVIDER);
        await this.userRepository.update(user);
      }
      return existing;
    }

    const profile = ProviderProfile.create(userId, bio);
    await this.providerProfileRepository.save(profile);
    user.setRole(UserRole.PROVIDER);
    await this.userRepository.update(user);

    return profile;
  }
}
