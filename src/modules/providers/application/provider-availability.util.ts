import { ProviderProfile } from '../domain/entities/provider-profile.entity';

export function isProviderAvailableNow(
  profile: ProviderProfile,
  now: Date = new Date(),
): boolean {
  if (!profile.isVerified || profile.verificationStatus !== 'APPROVED') {
    return false;
  }

  if (!profile.isAvailable) {
    return false;
  }

  const dayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const slot = profile.workingHours.find(
    (hour) =>
      hour.dayOfWeek === dayOfWeek &&
      hour.isActive &&
      typeof hour.startTime === 'string' &&
      typeof hour.endTime === 'string',
  );

  if (!slot) {
    return false;
  }

  const [startHour, startMinute] = slot.startTime.split(':').map(Number);
  const [endHour, endMinute] = slot.endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
