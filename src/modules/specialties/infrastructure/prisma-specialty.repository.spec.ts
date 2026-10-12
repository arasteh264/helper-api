import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaSpecialtyRepository } from './prisma-specialty.repository';

jest.mock('../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PrismaSpecialtyRepository public specialty reads', () => {
  it('selects only the fields available to public specialty consumers', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new PrismaSpecialtyRepository({
      specialty: { findMany },
    } as unknown as PrismaService);

    await repository.findActiveSpecialtiesByGroupId('group-1');

    const args = findMany.mock.calls[0][0];
    expect(args.select).toMatchObject({
      id: true,
      groupId: true,
      name: true,
      slug: true,
      pricingMode: true,
      hourlyRateToman: true,
      hourlyUnitLabel: true,
    });
    expect(args.select).not.toHaveProperty('allowsQuoteItems');
  });

  it('does not select specialty management fields in public grouped search', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new PrismaSpecialtyRepository({
      specialtyGroup: { findMany },
    } as unknown as PrismaService);

    await repository.findAllGroupedWithActiveProviderCounts();

    const args = findMany.mock.calls[0][0];
    expect(args.include.specialties.select).toMatchObject({
      id: true,
      groupId: true,
      name: true,
      slug: true,
      pricingMode: true,
      hourlyRateToman: true,
      hourlyUnitLabel: true,
    });
    expect(args.include.specialties.select).not.toHaveProperty(
      'allowsQuoteItems',
    );
  });
});
