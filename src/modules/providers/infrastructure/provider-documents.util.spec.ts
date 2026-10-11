import {
  type ProviderDocumentRecord,
  REQUIRED_PROVIDER_DOCUMENT_TYPES,
} from '../application/documents/provider-document.repository';
import { areRequiredDocumentsApproved } from './provider-documents.util';

function document(
  type: ProviderDocumentRecord['type'],
  status: ProviderDocumentRecord['status'],
): ProviderDocumentRecord {
  return {
    id: type,
    providerProfileId: 'provider-1',
    type,
    url: 'https://example.test/document',
    publicId: null,
    status,
    rejectionNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('areRequiredDocumentsApproved', () => {
  it('requires every required document to be approved', () => {
    expect(
      areRequiredDocumentsApproved(
        REQUIRED_PROVIDER_DOCUMENT_TYPES.slice(0, -1).map((type) =>
          document(type, 'APPROVED'),
        ),
      ),
    ).toBe(false);
  });

  it('rejects when a required document is still pending', () => {
    expect(
      areRequiredDocumentsApproved(
        REQUIRED_PROVIDER_DOCUMENT_TYPES.map((type, index) =>
          document(type, index === 0 ? 'PENDING' : 'APPROVED'),
        ),
      ),
    ).toBe(false);
  });

  it('allows approval only when all required documents are approved', () => {
    expect(
      areRequiredDocumentsApproved(
        REQUIRED_PROVIDER_DOCUMENT_TYPES.map((type) =>
          document(type, 'APPROVED'),
        ),
      ),
    ).toBe(true);
  });
});
