import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PROVIDER_DOCUMENT_REPOSITORY } from './provider-document.repository.token';
import type { ProviderDocumentRepository } from './provider-document.repository';


@Injectable()
export class ReviewProviderDocumentUseCase {
  constructor(
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
  ) {}

  async execute(
    documentId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionNote?: string,
  ) {
    const document = await this.providerDocumentRepository.findById(documentId);
    if (!document) throw new NotFoundException('Document not found');

    if (decision === 'REJECTED' && !rejectionNote) {
      throw new BadRequestException('rejectionNote is required when rejecting a document');
    }

    return this.providerDocumentRepository.updateStatus(
      documentId,
      decision,
      decision === 'REJECTED' ? rejectionNote : null,
    );
  }
}