import { ProviderDocumentRecord, REQUIRED_PROVIDER_DOCUMENT_TYPES } from "../application/documents/provider-document.repository";


export function areRequiredDocumentsApproved(
  documents: ProviderDocumentRecord[],
): boolean {
   if (documents.length === 0) return false;
  return documents.every((doc) => doc.status === 'APPROVED');
}

export function hasRejectedDocument(
  documents: ProviderDocumentRecord[],
): boolean {
  return documents.some((doc) => doc.status === 'REJECTED');
}