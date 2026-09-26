import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import { ProviderProfile } from '../domain/entities/provider-profile.entity';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import * as userRepository from '../../users/domain/repositories/user.repository';
import { UserRole } from '../../users/domain/entities/user-role.enum';

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
    console.log(existing);

    if (existing) {
      throw new ConflictException(
        'Provider profile already exists for this user',
      );
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = ProviderProfile.create(userId, bio);
    await this.providerProfileRepository.save(profile);

    return profile;
  }
}
