import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';

import type { ImageUploader } from '../../../shared/storage/image-uploader.port';
import { IMAGE_UPLOADER } from '../../../shared/storage/image-uploader.token';
import { PROVIDER_DOCUMENT_REPOSITORY } from './provider-document.repository.token';
import type {
  ProviderDocumentRecord,
  ProviderDocumentRepository,
} from './provider-document.repository';

@Injectable()
export class UploadProviderDocumentUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    @Inject(IMAGE_UPLOADER)
    private readonly imageUploader: ImageUploader,
  ) {}

  async execute(
    userId: string,
    type: ProviderDocumentRecord['type'],
    buffer: Buffer,
  ): Promise<ProviderDocumentRecord> {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const previous = (
      await this.providerDocumentRepository.findByProviderProfileId(profile.id)
    ).find((d) => d.type === type);

    const { url, publicId } = await this.imageUploader.upload(
      buffer,
      'provider-documents',
    );

    try {
      const document = await this.providerDocumentRepository.upsertByType({
        providerProfileId: profile.id,
        type,
        url,
        publicId,
      });

      if (previous?.publicId) {
        await this.imageUploader
          .delete(previous.publicId)
          .catch(() => undefined);
      }

      return document;
    } catch (error) {
      await this.imageUploader.delete(publicId).catch(() => undefined);
      throw error;
    }
  }
}
