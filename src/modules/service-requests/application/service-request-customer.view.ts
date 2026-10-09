export type CustomerViewSource = {
  id: string;
  title: string;
  description: string;
  status: string;
  adminReviewNote?: string | null;
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
  disputeReason?: string | null;
  disputeDescription?: string | null;
  disputeUpdatedAt?: Date | null;
  disputeResolvedAt?: Date | null;
  disputeResolution?: 'PROVIDER' | 'BUYER' | null;
  disputeResolutionNote?: string | null;
  disputeMessages?: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; name: string; role: string };
  }[];
  createdAt: Date;
  skills: { skill: { name: string } }[];
  specialtyName?: string | null;
  images: { id: string; url: string }[];
  acceptedProviderProfile: {
    id: string;
    rating: number;
    avatarUrl?: string | null;
    user: { name: string; phone: string };
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
      PENDING_ADMIN_REVIEW: 'awaiting_admin_review',
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
    adminReviewNote: request.adminReviewNote ?? null,
    dispute: request.disputeReason || request.status === 'DISPUTED'
      ? {
          reason: request.disputeReason ?? null,
          description: request.disputeDescription ?? null,
          updatedAt: request.disputeUpdatedAt?.toISOString() ?? null,
          resolved: Boolean(request.disputeResolvedAt),
          resolution: request.disputeResolution ?? null,
          resolutionNote: request.disputeResolutionNote ?? null,
          messages: (request.disputeMessages ?? []).map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
            authorId: message.author.id,
            authorName: message.author.name,
            authorRole: message.author.role,
          })),
        }
      : null,
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
          avatarUrl: provider.avatarUrl ?? null,
          ...(request.payments?.length ? { phone: provider.user.phone } : {}),
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
