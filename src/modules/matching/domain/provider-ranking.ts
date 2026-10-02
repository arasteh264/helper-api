// domain/provider-ranking.ts
import { haversineKm } from './distance';
import type {
  MatchingCriteria,
  ProviderCandidate,
} from './matching.repository';

export function rankCandidates(
  criteria: Pick<MatchingCriteria, 'latitude' | 'longitude'>,
  candidates: ProviderCandidate[],
  options: { batchSize: number; maxRadiusKm: number },
): { providerProfileId: string; distanceKm: number }[] {
  return candidates
    .map((c) => ({
      providerProfileId: c.providerProfileId,
      distanceKm:
        Math.round(
          haversineKm(
            criteria.latitude,
            criteria.longitude,
            c.latitude,
            c.longitude,
          ) * 10,
        ) / 10,
    }))
    .filter((c) => c.distanceKm <= options.maxRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, options.batchSize);
}