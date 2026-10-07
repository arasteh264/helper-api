import { rankCandidates } from './provider-ranking';

describe('rankCandidates', () => {
  it('uses each provider service radius to decide which requests they receive', () => {
    const results = rankCandidates(
      { latitude: 35.6892, longitude: 51.389 },
      [
        {
          providerProfileId: 'within-radius',
          latitude: 35.7792,
          longitude: 51.389,
          serviceAreaRadiusKm: 11,
        },
        {
          providerProfileId: 'outside-radius',
          latitude: 35.7792,
          longitude: 51.389,
          serviceAreaRadiusKm: 9,
        },
      ],
      { batchSize: 3 },
    );

    expect(results.map((result) => result.providerProfileId)).toEqual([
      'within-radius',
    ]);
    expect(results[0].distanceKm).toBe(10);
  });

  it('does not round a request just outside the provider radius into range', () => {
    const results = rankCandidates(
      { latitude: 35.6892, longitude: 51.389 },
      [
        {
          providerProfileId: 'just-outside-radius',
          latitude: 35.8692,
          longitude: 51.389,
          serviceAreaRadiusKm: 20,
        },
      ],
      { batchSize: 3 },
    );

    expect(results).toEqual([]);
  });
});
