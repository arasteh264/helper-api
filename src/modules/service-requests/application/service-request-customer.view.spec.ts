import {
  toCustomerView,
  type CustomerViewSource,
} from './service-request-customer.view';

function createRequest(payments: { id: string }[]): CustomerViewSource {
  return {
    id: 'request-12345678',
    title: 'تعمیرات',
    description: 'شرح درخواست',
    status: 'OFFER_ACCEPTED',
    address: 'نشانی مشتری',
    latitude: null,
    longitude: null,
    budgetMin: null,
    budgetMax: null,
    scheduledAt: null,
    createdAt: new Date('2026-09-24T10:00:00.000Z'),
    skills: [],
    specialtyName: 'تعمیرات',
    images: [],
    acceptedProviderProfile: {
      id: 'provider-profile-1',
      rating: 4.5,
      user: { name: 'متخصص', phone: '09120000000' },
    },
    payments,
  };
}

describe('toCustomerView contact privacy', () => {
  it('includes the specialist phone only after a successful payment', () => {
    const unpaid = toCustomerView(createRequest([]));
    const paid = toCustomerView(createRequest([{ id: 'payment-1' }]));

    expect(unpaid.specialist).not.toHaveProperty('phone');
    expect(paid.specialist).toMatchObject({ phone: '09120000000' });
  });
});
