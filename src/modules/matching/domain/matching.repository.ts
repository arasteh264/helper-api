// domain/matching.repository.ts
export interface MatchingCriteria {
  requestId: string;
  specialtyId: string | null;
  skillIds: string[];
  latitude: number;
  longitude: number;
}

export interface ProviderCandidate {
  providerProfileId: string;
  latitude: number;
  longitude: number;
}

export interface PendingNotification {
  invitationId: string;
  providerUserId: string;
  distanceKm: number | null;
  requestTitle: string;
  requestId: string;
}

export interface MatchingRepository {
  /** null اگه درخواست باز نیست، مختصات یا مهارت نداره */
  getCriteria(requestId: string): Promise<MatchingCriteria | null>;
  findCandidates(
    requestId: string,
    specialtyId: string | null,
    skillIds: string[],
  ): Promise<ProviderCandidate[]>;
  createInvitations(
    requestId: string,
    items: { providerProfileId: string; distanceKm: number }[],
  ): Promise<void>;
  findUnnotified(requestId: string): Promise<PendingNotification[]>;
  markNotified(invitationId: string): Promise<void>;
}
