// domain/provider-ranking.ts
import { haversineKm } from './distance';
import type {
  MatchingCriteria,
  ProviderCandidate,
} from './matching.repository';

export function rankCandidates(
  criteria: Pick<MatchingCriteria, 'latitude' | 'longitude'>,
  candidates: ProviderCandidate[],
  options: { batchSize: number },
): { providerProfileId: string; distanceKm: number }[] {
  return candidates
    .map((c) => ({
      providerProfileId: c.providerProfileId,
      serviceAreaRadiusKm: c.serviceAreaRadiusKm,
      distanceKm: haversineKm(
        criteria.latitude,
        criteria.longitude,
        c.latitude,
        c.longitude,
      ),
    }))
    .filter(
      (c) => c.distanceKm <= c.serviceAreaRadiusKm,
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, options.batchSize)
    .map(({ providerProfileId, distanceKm }) => ({
      providerProfileId,
      distanceKm: Math.round(distanceKm * 10) / 10,
    }));
}