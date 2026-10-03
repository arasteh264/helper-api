export type CustomerViewSource = {
  id: string;
  title: string;
  description: string;
  status: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  providerPriceToman?: number | null;
  providerPricingMode?: 'QUOTE' | 'HOURLY' | null;
  providerHourlyRateToman?: number | null;
  providerHourlyUnitLabel?: string | null;
  providerEstimatedHours?: number | null;
  scheduledAt: Date | null;
  createdAt: Date;
  skills: { skill: { name: string } }[];
  specialtyName?: string | null;
  images: { id: string; url: string }[];
  acceptedProviderProfile: {
    rating: number;
    user: { name: string };
  } | null;
};

export function toCustomerView(request: CustomerViewSource) {
  const provider = request.acceptedProviderProfile;
  const status =
    {
      OPEN: 'awaiting_offers',
      OFFER_ACCEPTED: 'offers_received',
      CUSTOMER_CONFIRMATION_PENDING: 'awaiting_payment',
      IN_PROGRESS: 'in_progress',
      AWAITING_CUSTOMER_CONFIRMATION: 'awaiting_confirmation',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      EXPIRED: 'cancelled',
      DISPUTED: 'disputed',
    }[request.status] ?? 'awaiting_offers';
  return {
    id: request.id,
    code: `R-${request.id.slice(0, 8).toUpperCase()}`,
    title: request.title,
    category:
      request.specialtyName ??
      request.skills.map((item) => item.skill.name).join('، '),
    description: request.description,
    addressLabel: request.address ?? '',
    latitude: request.latitude,
    longitude: request.longitude,
    createdAt: request.createdAt.toISOString(),
    scheduledAt: request.scheduledAt?.toISOString(),
    status,
    offersCount: provider ? 1 : 0,
    budget:
      request.budgetMin !== null && request.budgetMax !== null
        ? { min: request.budgetMin, max: request.budgetMax }
        : undefined,
    price:
      request.providerPriceToman ??
      request.budgetMax ??
      request.budgetMin ??
      undefined,
    priceDetails:
      request.providerPricingMode === 'HOURLY'
        ? {
            mode: 'HOURLY',
            hourlyRateToman: request.providerHourlyRateToman,
            hourlyUnitLabel: request.providerHourlyUnitLabel,
            estimatedHours: request.providerEstimatedHours,
          }
        : request.providerPricingMode === 'QUOTE'
          ? { mode: 'QUOTE' }
          : undefined,
    specialist: provider
      ? {
          id: request.id,
          name: provider.user.name,
          field:
            request.specialtyName ??
            request.skills.map((item) => item.skill.name).join('، '),
          rating: provider.rating,
        }
      : undefined,
    images: request.images.map((image) => image.url),
    reviewed: false,
  };
}
