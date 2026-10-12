import type { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { PrismaProviderProfileRepository } from './prisma-provider-profile.repository';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PrismaProviderProfileRepository profile detail reads', () => {
  it('selects only public specialty and group fields', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const repository = new PrismaProviderProfileRepository({
      providerProfile: { findUnique },
    } as unknown as PrismaService);

    await repository.findDetailsByUserId('user-1');

    const specialtySelect =
      findUnique.mock.calls[0][0].include.specialties.include.specialty.select;
    expect(specialtySelect).toMatchObject({
      id: true,
      name: true,
      slug: true,
      icon: true,
      groupId: true,
      group: { select: { name: true } },
    });
    expect(specialtySelect).not.toHaveProperty('allowsQuoteItems');
    expect(specialtySelect.group.select).toEqual({ name: true });
  });
});
