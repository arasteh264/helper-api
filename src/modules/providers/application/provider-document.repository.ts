export interface ProviderDocumentRecord {
  id: string;
  providerProfileId: string;
  type:
    | 'NATIONAL_CARD'
    | 'BUSINESS_LICENSE'
    | 'CERTIFICATE'
    | 'COMMITMENT_LETTER'
    | 'OTHER';
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
