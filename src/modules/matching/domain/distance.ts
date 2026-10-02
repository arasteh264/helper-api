export function haversineKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(latB - latA);
  const dLng = rad(lngB - lngA);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}