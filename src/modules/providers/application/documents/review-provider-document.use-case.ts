import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PROVIDER_DOCUMENT_REPOSITORY } from './provider-document.repository.token';
import type { ProviderDocumentRepository } from './provider-document.repository';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { areRequiredDocumentsApproved } from '../../infrastructure/provider-documents.util';

@Injectable()
export class ReviewProviderDocumentUseCase {
  constructor(
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(
    documentId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionNote?: string,
    adminUserId?: string,
  ) {
    const document = await this.providerDocumentRepository.findById(documentId);
    if (!document) throw new NotFoundException('Document not found');

    const normalizedRejectionNote = rejectionNote?.trim();
    if (decision === 'REJECTED' && (normalizedRejectionNote?.length ?? 0) < 3) {
      throw new BadRequestException('برای رد مدرک، دلیل معتبر الزامی است');
    }

    const updatedDocument = await this.providerDocumentRepository.updateStatus(
      documentId,
      decision,
      decision === 'REJECTED' ? normalizedRejectionNote! : null,
      adminUserId,
    );

    if (adminUserId) {
      await this.syncProviderVerification(
        document.providerProfileId,
        adminUserId,
      );
    }

    return updatedDocument;
  }

  private async syncProviderVerification(
    providerProfileId: string,
    adminUserId: string,
  ): Promise<void> {
    const profile =
      await this.providerProfileRepository.findById(providerProfileId);
    if (!profile) return;

    // اگه ادمین قبلاً دستی رد یا تأیید کرده، دیگه دست‌کاری خودکار نکن
    if (profile.verificationStatus !== 'PENDING') return;

    const documents =
      await this.providerDocumentRepository.findByProviderProfileId(
        providerProfileId,
      );

    if (areRequiredDocumentsApproved(documents)) {
      const beforeState = {
        verificationStatus: profile.verificationStatus,
        verificationNote: profile.verificationNote,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
      };
      profile.verify();
      await this.providerProfileRepository.update(profile, {
        actorUserId: adminUserId,
        action: 'PROVIDER_AUTO_APPROVED_AFTER_DOCUMENTS',
        reason: 'تمام مدارک اجباری متخصص تأیید شد',
        beforeState,
        afterState: {
          verificationStatus: profile.verificationStatus,
          verificationNote: profile.verificationNote,
          verifiedAt: profile.verifiedAt?.toISOString() ?? null,
        },
      });
    }
  }
}
