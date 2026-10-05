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
  customerConfirmationDeadline?: Date | null;
  createdAt: Date;
  skills: { skill: { name: string } }[];
  specialtyName?: string | null;
  images: { id: string; url: string }[];
  acceptedProviderProfile: {
    id: string;
    rating: number;
    user: { name: string };
  } | null;
  review?: {
    id: string;
    rating: number;
    text: string | null;
    createdAt: Date;
  } | null;
  payments?: { id: string }[];
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
    customerConfirmationDeadline:
      request.customerConfirmationDeadline?.toISOString(),
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
          id: provider.id,
          name: provider.user.name,
          field:
            request.specialtyName ??
            request.skills.map((item) => item.skill.name).join('، '),
          rating: provider.rating,
        }
      : undefined,
    images: request.images.map((image) => image.url),
    reviewed: Boolean(request.review),
    review: request.review
      ? {
          id: request.review.id,
          rating: request.review.rating,
          text: request.review.text,
          createdAt: request.review.createdAt.toISOString(),
        }
      : null,
    wasPaid: (request.payments?.length ?? 0) > 0,
  };
}
