import { ProviderProfile } from '../domain/entities/provider-profile.entity';
import { isProviderAvailableNow } from './provider-availability.util';

describe('Provider availability matching', () => {
  it('accepts a provider only when they are approved, available, and in an active time slot', () => {
    const profile = ProviderProfile.create('user-1', 'bio');
    profile.verify();
    profile.setAvailability(true);
    profile.setWorkingHours([
      { dayOfWeek: 6, isActive: true, startTime: '08:00', endTime: '21:00' },
    ]);

    expect(
      isProviderAvailableNow(profile, new Date(2026, 8, 26, 10, 0, 0)),
    ).toBe(true);
    expect(
      isProviderAvailableNow(profile, new Date(2026, 8, 26, 22, 0, 0)),
    ).toBe(false);
    expect(
      isProviderAvailableNow(profile, new Date(2026, 8, 27, 10, 0, 0)),
    ).toBe(false);
  });
});
