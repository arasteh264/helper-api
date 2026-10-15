import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProviderArticlesService } from './provider-articles.service';

describe('ProviderArticlesService', () => {
  const prisma = {
    providerProfile: { findUnique: jest.fn() },
    specialtyGroup: { findMany: jest.fn() },
    specialty: { findMany: jest.fn() },
    providerArticle: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
    },
    providerArticleRating: { create: jest.fn(), groupBy: jest.fn() },
  };
  const service = new ProviderArticlesService(
    prisma as unknown as PrismaService,
  );
  const input = {
    slug: 'safe-electrical-work',
    title: 'Safe electrical work',
    excerpt: 'A guide to electrical safety.',
    content: [
      { type: 'paragraph' as const, text: 'Turn off the power first.' },
    ],
    coverImage: 'https://images.example.test/electrical-safety.jpg',
    categoryIds: ['group-1'],
    specialtyIds: ['specialty-1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.providerProfile.findUnique.mockResolvedValue({ id: 'profile-1' });
    prisma.specialtyGroup.findMany.mockResolvedValue([{ id: 'group-1' }]);
    prisma.specialty.findMany.mockResolvedValue([
      { id: 'specialty-1', groupId: 'group-1' },
    ]);
  });

  it('submits provider content only into the review queue', async () => {
    prisma.providerArticle.create.mockResolvedValue({
      id: 'article-1',
      status: 'PENDING_REVIEW',
    });

    await service.submit('provider-user-1', input);

    expect(prisma.providerArticle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerProfileId: 'profile-1',
          status: 'PENDING_REVIEW',
        }),
      }),
    );
    expect(
      prisma.providerArticle.create.mock.calls[0][0].data,
    ).not.toHaveProperty('publishedAt');
  });

  it('rejects non-provider accounts without a provider profile', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue(null);

    await expect(service.submit('customer-1', input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.providerArticle.create).not.toHaveBeenCalled();
  });

  it('rejects articles containing contact details', async () => {
    await expect(
      service.submit('provider-user-1', {
        ...input,
        excerpt: 'Contact expert@example.com for a quote.',
      }),
    ).rejects.toThrow('ثبت شماره تماس یا ایمیل در مقاله آموزشی مجاز نیست');
    expect(prisma.providerArticle.create).not.toHaveBeenCalled();
  });

  it('lists only approved provider articles publicly', async () => {
    prisma.providerArticle.findMany.mockResolvedValue([]);
    prisma.providerArticle.count.mockResolvedValue(0);

    await service.listPublic({ page: 1, pageSize: 10 });

    expect(prisma.providerArticle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'APPROVED' },
      }),
    );
    expect(prisma.providerArticleRating.groupBy).not.toHaveBeenCalled();
  });

  it('allows each customer to rate an article only once', async () => {
    prisma.providerArticle.findFirst.mockResolvedValue({ id: 'article-1' });
    prisma.providerArticleRating.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.rate('article-1', 'customer-1', { rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a reason when an administrator rejects an article', async () => {
    await expect(
      service.review('article-1', 'admin-1', {
        decision: 'REJECT',
        reviewNote: ' ',
      }),
    ).rejects.toThrow('برای رد مقاله باید دلیل ثبت شود');
    expect(prisma.providerArticle.updateMany).not.toHaveBeenCalled();
  });
});
