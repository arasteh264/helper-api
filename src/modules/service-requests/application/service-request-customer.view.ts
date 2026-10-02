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
  scheduledAt: Date | null;
  createdAt: Date;
  skills: { skill: { name: string } }[];
  images: { id: string; url: string }[];
  acceptedProviderProfile: {
    rating: number;
    user: { name: string; phone: string };
  } | null;
};

export function toCustomerView(request: CustomerViewSource) {
  const provider = request.acceptedProviderProfile;
  const status =
    {
      OPEN: 'awaiting_offers',
      OFFER_ACCEPTED: 'offers_received',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      EXPIRED: 'cancelled',
      DISPUTED: 'in_progress',
    }[request.status] ?? 'awaiting_offers';
  return {
    id: request.id,
    code: `R-${request.id.slice(0, 8).toUpperCase()}`,
    title: request.title,
    category: request.skills.map((item) => item.skill.name).join('، '),
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
    price: request.budgetMax ?? request.budgetMin ?? undefined,
    specialist: provider
      ? {
          id: request.id,
          name: provider.user.name,
          field: request.skills.map((item) => item.skill.name).join('، '),
          rating: provider.rating,
          phone: provider.user.phone,
        }
      : undefined,
    images: request.images.map((image) => image.url),
    reviewed: false,
  };
}