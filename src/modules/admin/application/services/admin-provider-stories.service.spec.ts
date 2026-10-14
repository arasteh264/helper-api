import { AdminProviderStoriesService } from './admin-provider-stories.service';

jest.mock('../../../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AdminProviderStoriesService provider access search', () => {
  it('searches provider names and emails case-insensitively', async () => {
    const profiles = [
      {
        id: 'profile-1',
        isVerified: true,
        canPublishStories: false,
        canViewStoryStats: false,
        user: { name: 'Ava Provider', email: 'ava@example.test' },
      },
    ];
    const prisma = {
      providerProfile: {
        findMany: jest.fn().mockResolvedValue(profiles),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new AdminProviderStoriesService(
      prisma as never,
      {} as never,
    );

    await expect(service.listProviderAccess(1, 20, '  ava ')).resolves.toEqual({
      items: [
        {
          providerProfileId: 'profile-1',
          providerName: 'Ava Provider',
          email: 'ava@example.test',
          isVerified: true,
          canPublishStories: false,
          canViewStoryStats: false,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    const expectedWhere = {
      user: {
        role: 'PROVIDER',
        OR: [
          { name: { contains: 'ava', mode: 'insensitive' } },
          { email: { contains: 'ava', mode: 'insensitive' } },
        ],
      },
    };
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(prisma.providerProfile.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });
});
