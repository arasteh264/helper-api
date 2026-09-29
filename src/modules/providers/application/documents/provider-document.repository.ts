// provider-document.repository.ts
export type ProviderDocumentType =
  | 'NATIONAL_CARD'
  | 'BUSINESS_LICENSE'
  | 'CERTIFICATE'
  | 'COMMITMENT_LETTER'
  | 'CRIMINAL_RECORD'
  | 'OTHER';

export interface ProviderDocumentRecord {
  id: string;
  providerProfileId: string;
  type: ProviderDocumentType;
  url: string;
  publicId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertProviderDocumentInput {
  providerProfileId: string;
  type: ProviderDocumentRecord['type'];
  url: string;
  publicId: string;
}

export interface ProviderDocumentRepository {
  upsertByType(
    input: UpsertProviderDocumentInput,
  ): Promise<ProviderDocumentRecord>;
  findByProviderProfileId(
    providerProfileId: string,
  ): Promise<ProviderDocumentRecord[]>;
  findById(id: string): Promise<ProviderDocumentRecord | null>;
  updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionNote?: string | null,
  ): Promise<ProviderDocumentRecord>;
}

// مدارکی که ادمین حتماً باید تأیید کنه تا پروفایل بتونه وریفای بشه.
// اگه لازمه CRIMINAL_RECORD یا مدرک دیگه‌ای اختیاری باشه، همینجا حذفش کن.
export const REQUIRED_PROVIDER_DOCUMENT_TYPES: ProviderDocumentType[] = [
  'NATIONAL_CARD',
  'BUSINESS_LICENSE',
  'CERTIFICATE',
  'COMMITMENT_LETTER',
  'CRIMINAL_RECORD',
];