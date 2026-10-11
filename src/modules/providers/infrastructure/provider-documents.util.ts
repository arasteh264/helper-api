import { ProviderDocumentRecord, REQUIRED_PROVIDER_DOCUMENT_TYPES } from "../application/documents/provider-document.repository";


export function areRequiredDocumentsApproved(
  documents: ProviderDocumentRecord[],
): boolean {
  const approvedTypes = new Set(
    documents
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return REQUIRED_PROVIDER_DOCUMENT_TYPES.every((type) =>
    approvedTypes.has(type),
  );
}

export function hasRejectedDocument(
  documents: ProviderDocumentRecord[],
): boolean {
  return documents.some((doc) => doc.status === 'REJECTED');
}