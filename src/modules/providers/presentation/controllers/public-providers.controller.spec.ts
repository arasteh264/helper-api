import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { PublicProvidersController } from './public-providers.controller';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PublicProvidersController public provider queries', () => {
  it('does not select specialty fields that may be absent from an unmigrated database', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const controller = new PublicProvidersController({
      providerProfile: { findMany, count },
    } as unknown as PrismaService);

    await controller.list(undefined, undefined, '1', '16');

    const args = findMany.mock.calls[0][0];
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
});
