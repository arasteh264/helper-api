import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import type { ImageUploader } from '@/shared/storage/image-uploader.port';
import { IMAGE_UPLOADER } from '@/shared/storage/image-uploader.token'; 

@Injectable()
export class RemoveProviderAvatarUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(IMAGE_UPLOADER) 
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(userId: string): Promise<void> {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const oldPublicId = profile.avatarPublicId;

    profile.removeAvatar();
    await this.providerProfileRepository.update(profile);

    if (oldPublicId) {
      await this.imageUploader.delete(oldPublicId).catch(() => undefined);
    }
  }
}