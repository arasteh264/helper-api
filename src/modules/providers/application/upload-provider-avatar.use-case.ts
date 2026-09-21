import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import type { ImageUploader } from '../../../shared/storage/image-uploader.port';
// ⚠️ این import و @Inject پایین رو دقیقاً مثل UploadServiceRequestImageUseCase بنویس
import { IMAGE_UPLOADER } from '../../../shared/storage/image-uploader.token';

@Injectable()
export class UploadProviderAvatarUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(userId: string, buffer: Buffer): Promise<{ avatarUrl: string }> {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const oldPublicId = profile.avatarPublicId;
    const { url, publicId } = await this.imageUploader.upload(
      buffer,
      'provider-avatars',
    );

    try {
      profile.changeAvatar(url, publicId);
      await this.providerProfileRepository.update(profile);
    } catch (error) {
      // ذخیره توی دیتابیس شکست خورد، پس عکس تازه آپلودشده یتیم نمونه
      await this.imageUploader.delete(publicId).catch(() => undefined);
      throw error;
    }

    // عکس قبلی فقط بعد از ذخیره موفق پاک می‌شه
    if (oldPublicId) {
      await this.imageUploader.delete(oldPublicId).catch(() => undefined);
    }

    return { avatarUrl: url };
  }
}