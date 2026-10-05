import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BlogService } from './blog.service';

jest.mock('../../infrastructure/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('BlogService', () => {
  it('limits public results to published posts and searches half-space variants', async () => {
    const findManyCalls: Prisma.BlogPostFindManyArgs[] = [];
    const prisma = {
      blogPost: {
        findMany: jest.fn((args: Prisma.BlogPostFindManyArgs) => {
          findManyCalls.push(args);
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new BlogService(prisma as unknown as PrismaService);

    await service.listPublic({
      page: 1,
      pageSize: 10,
      search: 'لوله کش',
    });

    const query = JSON.stringify(findManyCalls[0] ?? {});
    expect(query).toContain('"status":"PUBLISHED"');
    expect(query).toContain('"contains":"لوله‌کش"');
    expect(query).toContain('"take":10');
  });

  it('rejects unsafe slugs before writing a post', async () => {
    let createCalls = 0;
    const prisma = {
      blogPost: {
        create: jest.fn(() => {
          createCalls += 1;
          return Promise.resolve({});
        }),
      },
    };
    const service = new BlogService(prisma as unknown as PrismaService);

    await expect(
      service.create({
        slug: 'لوله-کش',
        title: 'عنوان',
        excerpt: 'خلاصه',
        category: 'لوله‌کشی',
        categorySlug: 'plumbing',
        authorName: 'تحریریه هلپر',
        authorRole: 'نویسنده',
        content: [{ type: 'paragraph', text: 'محتوا' }],
        status: 'DRAFT',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createCalls).toBe(0);
  });

  it('derives a minimum-one-minute reading time and creates a publish date', async () => {
    const createdData: {
      readingMinutes: number;
      status: string;
      publishedAt: Date;
    }[] = [];
    const prisma = {
      blogPost: {
        create: jest.fn(
          ({
            data,
          }: {
            data: {
              readingMinutes: number;
              status: string;
              publishedAt: Date;
            };
          }) => {
            createdData.push(data);
            return Promise.resolve({
              ...data,
              id: 'post-1',
              updatedAt: new Date(),
            });
          },
        ),
      },
    };
    const service = new BlogService(prisma as unknown as PrismaService);

    const result = await service.create({
      slug: 'find-a-plumber',
      title: 'انتخاب لوله‌کش',
      excerpt: 'راهنمای انتخاب',
      category: 'لوله‌کشی',
      categorySlug: 'plumbing',
      authorName: 'تحریریه هلپر',
      authorRole: 'راهنمای خدمات',
      content: [{ type: 'paragraph', text: 'متن کاربردی مقاله' }],
      status: 'PUBLISHED',
    });

    expect(createdData[0]?.readingMinutes).toBe(1);
    expect(createdData[0]?.status).toBe('PUBLISHED');
    expect(createdData[0]?.publishedAt).toBeInstanceOf(Date);
    expect(result.id).toBe('post-1');
  });
});
