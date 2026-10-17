import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { PublicProvidersController } from './public-providers.controller';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PublicProvidersController public provider queries', () => {
  it('does not select specialty fields that may be absent from an unmigrated database', async () => {
    const findMany = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
    const count = jest.fn<() => Promise<number>>().mockResolvedValue(0);
    const controller = new PublicProvidersController({
      providerProfile: { findMany, count },
    } as unknown as PrismaService);

    await controller.list(undefined, undefined, '1', '16');

    const mockedFindMany = findMany as jest.MockedFunction<
      () => Promise<unknown[]>
    >;
    const args = mockedFindMany.mock.calls[0][0] as {
      include: {
        specialties: {
          include: {
            specialty: {
              select: Record<string, unknown>;
            };
          };
        };
      };
    };
    const specialtySelect = args.include.specialties.include.specialty.select;
    expect(specialtySelect).toMatchObject({
      id: true,
      name: true,
      slug: true,
      icon: true,
      groupId: true,
      group: { select: { name: true } },
    });
    expect(specialtySelect).not.toHaveProperty('allowsQuoteItems');
  });

  it('includes the provider service radius in public listings', async () => {
    const mockProvider = {
      user: { name: 'Test Provider' },
      bio: null,
      rating: 4.8,
      _count: { reviews: 12, acceptedServiceRequests: 20 },
      isVerified: true,
      isAvailable: true,
      serviceAreaLatitude: 35.7,
      serviceAreaLongitude: 51.4,
      serviceAreaRadiusKm: 15,
      avatarUrl: null,
      skills: [],
      specialties: [],
      portfolioItems: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const findMany = jest.fn().mockResolvedValue([mockProvider]);
    const controller = new PublicProvidersController({
      providerProfile: { findMany, count: jest.fn() },
    } as unknown as PrismaService);

    const providers = await controller.list();

    expect(providers[0]).toMatchObject({
      hasServiceArea: true,
      serviceAreaRadiusKm: 15,
    });
  });
});
