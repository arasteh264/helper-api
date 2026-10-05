import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AdminBlogQueryDto } from './dto/admin-blog-query.dto';
import type { BlogPostFieldsDto } from './dto/blog-content-block.dto';

const PUBLIC_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  categorySlug: true,
  authorName: true,
  authorRole: true,
  content: true,
  coverImage: true,
  coverAlt: true,
  coverTint: true,
  readingMinutes: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  tags: true,
  publishedAt: true,
  updatedAt: true,
} satisfies Prisma.BlogPostSelect;

const SUMMARY_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  categorySlug: true,
  authorName: true,
  authorRole: true,
  coverImage: true,
  coverAlt: true,
  coverTint: true,
  readingMinutes: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  tags: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BlogPostSelect;

function getSearchVariants(search: string): string[] {
  const normalized = search
    .normalize('NFKC')
    .replace(/[يك]/g, (char) => (char === 'ي' ? 'ی' : 'ک'));
  const noJoiners = normalized.replace(/\u200c/g, ' ');
  const variants = [
    normalized,
    noJoiners,
    noJoiners.replace(/\s+/g, '\u200c'),
    noJoiners.replace(/\s+/g, ''),
  ];
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))];
}

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(input: {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    tag?: string;
  }) {
    const searchTerms = input.search ? getSearchVariants(input.search) : [];
    const where: Prisma.BlogPostWhereInput = {
      status: 'PUBLISHED',
      ...(input.category ? { categorySlug: input.category } : {}),
      ...(input.tag ? { tags: { has: input.tag } } : {}),
      ...(searchTerms.length
        ? {
            OR: searchTerms.flatMap((term) => [
              { title: { contains: term, mode: 'insensitive' as const } },
              { excerpt: { contains: term, mode: 'insensitive' as const } },
              { tags: { has: term } },
            ]),
          }
        : {}),
    };
    const [items, total, categories] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: SUMMARY_FIELDS,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where: { status: 'PUBLISHED' },
        select: { category: true, categorySlug: true },
        distinct: ['categorySlug'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      categories,
    };
  }

  async getPublicBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: PUBLIC_FIELDS,
    });
    if (!post) throw new NotFoundException('مقاله پیدا نشد');
    return post;
  }

  async listAdmin(query: AdminBlogQueryDto) {
    const where: Prisma.BlogPostWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        select: SUMMARY_FIELDS,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getAdminById(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      select: PUBLIC_FIELDS,
    });
    if (!post) throw new NotFoundException('مقاله پیدا نشد');
    return post;
  }

  async create(input: BlogPostFieldsDto) {
    const data = this.toWriteData(input);
    try {
      return await this.prisma.blogPost.create({
        data: {
          ...data,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
        },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      this.handleUniqueSlug(error);
      throw error;
    }
  }

  async update(id: string, input: BlogPostFieldsDto) {
    const existing = await this.prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, status: true, publishedAt: true },
    });
    if (!existing) throw new NotFoundException('مقاله پیدا نشد');
    const data = this.toWriteData(input);
    try {
      return await this.prisma.blogPost.update({
        where: { id },
        data: {
          ...data,
          publishedAt:
            input.status === 'DRAFT'
              ? null
              : existing.status === 'PUBLISHED'
                ? (existing.publishedAt ?? new Date())
                : new Date(),
        },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      this.handleUniqueSlug(error);
      throw error;
    }
  }

  private toWriteData(
    input: BlogPostFieldsDto,
  ): Prisma.BlogPostUncheckedCreateInput {
    const requiredFields = [
      input.title,
      input.excerpt,
      input.category,
      input.categorySlug,
      input.authorName,
      input.authorRole,
    ];
    if (requiredFields.some((value) => !value.trim())) {
      throw new BadRequestException(
        'عنوان، خلاصه، دسته و نویسنده الزامی هستند',
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
      throw new BadRequestException(
        'نشانی مقاله باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد',
      );
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.categorySlug)) {
      throw new BadRequestException(
        'نشانی دسته‌بندی باید فقط شامل حروف انگلیسی کوچک، عدد و خط تیره باشد',
      );
    }
    if (input.content.length === 0) {
      throw new BadRequestException('متن مقاله نمی‌تواند خالی باشد');
    }
    for (const block of input.content) {
      if (block.type === 'list') {
        if (!block.items?.length || block.items.some((item) => !item.trim())) {
          throw new BadRequestException(
            'فهرست مقاله باید دست‌کم یک مورد داشته باشد',
          );
        }
      } else if (!block.text?.trim()) {
        throw new BadRequestException('بلوک متنی مقاله نمی‌تواند خالی باشد');
      }
    }
    if (input.canonicalUrl) {
      let canonical: URL;
      try {
        canonical = new URL(input.canonicalUrl);
      } catch {
        throw new BadRequestException('نشانی canonical معتبر نیست');
      }
      if (!['http:', 'https:'].includes(canonical.protocol)) {
        throw new BadRequestException(
          'نشانی canonical باید HTTP یا HTTPS باشد',
        );
      }
    }
    if (input.coverImage) {
      let coverImage: URL;
      try {
        coverImage = new URL(input.coverImage);
      } catch {
        throw new BadRequestException('نشانی تصویر کاور معتبر نیست');
      }
      if (coverImage.protocol !== 'https:') {
        throw new BadRequestException('نشانی تصویر کاور باید HTTPS باشد');
      }
    }

    const wordCount = input.content.reduce(
      (count, block) =>
        count +
        (block.type === 'list'
          ? (block.items ?? []).join(' ').split(/\s+/).filter(Boolean).length
          : (block.text ?? '').split(/\s+/).filter(Boolean).length),
      0,
    );
    return {
      slug: input.slug,
      title: input.title.trim(),
      excerpt: input.excerpt.trim(),
      category: input.category.trim(),
      categorySlug: input.categorySlug.trim(),
      authorName: input.authorName.trim(),
      authorRole: input.authorRole.trim(),
      content: input.content.map((block) =>
        block.type === 'list'
          ? { type: block.type, items: block.items ?? [] }
          : { type: block.type, text: block.text ?? '' },
      ),
      coverImage: input.coverImage?.trim() || null,
      coverAlt: input.coverAlt?.trim() || null,
      coverTint:
        input.coverTint?.trim() ||
        'from-emerald-500/25 via-emerald-500/10 to-transparent',
      readingMinutes: Math.max(1, Math.ceil(wordCount / 220)),
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      canonicalUrl: input.canonicalUrl?.trim() || null,
      tags: [
        ...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
      ],
      status: input.status,
    };
  }

  private handleUniqueSlug(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('این نشانی برای مقاله‌ی دیگری ثبت شده است');
    }
  }
}
