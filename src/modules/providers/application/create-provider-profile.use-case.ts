import {
  Inject,
  Injectable,
  ConflictException,
} from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import { ProviderProfile } from '../domain/entities/provider-profile.entity';

@Injectable()
export class CreateProviderProfileUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(userId: string, bio: string | null): Promise<ProviderProfile> {
    const existing = await this.providerProfileRepository.findByUserId(userId);

    if (existing) {
      throw new ConflictException('Provider profile already exists for this user');
    }

    const profile = ProviderProfile.create(userId, bio);
    await this.providerProfileRepository.save(profile);

    return profile;
  }
}