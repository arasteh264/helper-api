import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProviderProfileRepository } from '../domain/repositories/provider-profile.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../domain/repositories/provider-profile.repository.token';
import { PROVIDER_DOCUMENT_REPOSITORY } from './provider-document.repository.token';
import type { ProviderDocumentRepository } from './provider-document.repository';

@Injectable()
export class GetMyDocumentsUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
  ) {}

  async execute(userId: string) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    return this.providerDocumentRepository.findByProviderProfileId(profile.id);
  }
}
