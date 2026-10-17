import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import { IMAGE_UPLOADER } from '../../shared/storage/image-uploader.token';
import type { ImageUploader } from '../../shared/storage/image-uploader.port';
import type {
  AdminProviderArticleListQueryDto,
  ProviderArticleListQueryDto,
  RateProviderArticleDto,
  ReviewProviderArticleDto,
  SubmitProviderArticleDto,
  UploadProviderArticleCoverDto,
} from './dto/provider-article.dto';

const ARTICLE_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  coverImage: true,
  coverAlt: true,
  readingMinutes: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  providerProfile: {
    select: { user: { select: { name: true } } },
  },
  categories: {
    select: {
      specialtyGroup: { select: { id: true, name: true, slug: true } },
    },
  },
  specialties: {
    select: {
      specialty: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
} satisfies Prisma.ProviderArticleSelect;

const PUBLIC_ARTICLE_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  coverImage: true,
  coverAlt: true,
  readingMinutes: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  providerProfile: {
    select: { user: { select: { name: true } } },
  },
  categories: {
    select: {
      specialtyGroup: { select: { id: true, name: true, slug: true } },
    },
  },
  specialties: {
    select: {
      specialty: {
        select: {
          id: true,
          name: true,
          slug: true,
          group: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
} satisfies Prisma.ProviderArticleSelect;

const MY_ARTICLE_FIELDS = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  coverAlt: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    select: {
      specialtyGroup: { select: { id: true, name: true, slug: true } },
    },
  },
  specialties: {
    select: {
      specialty: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.ProviderArticleSelect;

function prismaCode(error: unknown): string | undefined {
  return (error as { code?: string })?.code;
}

function getContentWords(content: SubmitProviderArticleDto['content']) {
  return content
    .flatMap((block) => [block.text ?? '', ...(block.items ?? [])])
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function containsContactInformation(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) ||
    /(?:\+?\d[\s().-]*){9,}/.test(normalized)
  );
}

@Injectable()
export class ProviderArticlesService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject(IMAGE_UPLOADER) private readonly imageUploader: ImageUploader,
  ) {}

  async submit(userId: string, input: SubmitProviderArticleDto) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true, canPublishArticles: true },
    });
    if (!profile) {
      throw new ForbiddenException('ثبت مقاله برای پروفایل متخصص مجاز است');
    }
    if (!profile.canPublishArticles) {
      throw new ForbiddenException(
        'دسترسی انتشار مقاله برای پروفایل شما هنوز توسط پشتیبانی فعال نشده است',
      );
    }
    this.validateArticle(input);
    await this.validateTaxonomy(input);

    try {
      return await this.prisma.providerArticle.create({
        data: {
          providerProfileId: profile.id,
          slug: input.slug.trim(),
          title: input.title.trim(),
          excerpt: input.excerpt.trim(),
          content: input.content as unknown as Prisma.InputJsonValue,
          coverImage: input.coverImage?.trim() || null,
          coverPublicId: null,
          coverAlt: input.coverAlt?.trim() || null,
          readingMinutes:
            input.readingMinutes ??
            Math.max(1, Math.ceil(getContentWords(input.content) / 200)),
          status: 'PENDING_REVIEW',
          categories: {
            create: (input.categoryIds ?? []).map((specialtyGroupId) => ({
              specialtyGroupId,
            })),
          },
          specialties: {
            create: input.specialtyIds.map((specialtyId) => ({
              specialtyId,
            })),
          },
        },
        select: ARTICLE_FIELDS,
      });
    } catch (error) {
      if (prismaCode(error) === 'P2002') {
        throw new ConflictException('نشانی این مقاله قبلاً استفاده شده است');
      }
      throw error;
    }
  }

  async uploadCover(
    userId: string,
    articleId: string,
    file: Express.Multer.File,
    input: UploadProviderArticleCoverDto,
  ) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('بارگذاری کاور فقط برای متخصص مجاز است');
    }
    const article = await this.prisma.providerArticle.findFirst({
      where: {
        id: articleId,
        providerProfileId: profile.id,
        status: 'PENDING_REVIEW',
      },
      select: { id: true, coverPublicId: true },
    });
    if (!article) {
      const exists = await this.prisma.providerArticle.findUnique({
        where: { id: articleId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('مقاله پیدا نشد');
      throw new ForbiddenException(
        'فقط مالک مقاله‌ای که در انتظار بررسی است می‌تواند کاور بارگذاری کند',
      );
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل کاور معتبر نیست');
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      throw new BadRequestException(
        'فقط تصویر JPEG، PNG یا WebP پذیرفته می‌شود',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('حداکثر حجم تصویر کاور ۵ مگابایت است');
    }
    if (input.coverAlt && containsContactInformation(input.coverAlt)) {
      throw new BadRequestException(
        'ثبت شماره تماس یا ایمیل در توضیح تصویر مجاز نیست',
      );
    }

    const uploaded = await this.imageUploader.upload(
      file.buffer,
      'provider-article-covers',
    );
    let updated: {
      id: string;
      coverImage: string | null;
      coverAlt: string | null;
      status: string;
      updatedAt: Date;
    };
    try {
      const result = await this.prisma.providerArticle.updateMany({
        where: {
          id: article.id,
          providerProfileId: profile.id,
          status: 'PENDING_REVIEW',
        },
        data: {
          coverImage: uploaded.url,
          coverPublicId: uploaded.publicId,
          ...(input.coverAlt !== undefined
            ? { coverAlt: input.coverAlt.trim() || null }
            : {}),
        },
      });
      if (!result.count) {
        throw new ConflictException('مقاله هم‌زمان تغییر کرده است');
      }
      updated = await this.prisma.providerArticle.findUniqueOrThrow({
        where: { id: article.id },
        select: {
          id: true,
          coverImage: true,
          coverAlt: true,
          status: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      await this.imageUploader.delete(uploaded.publicId).catch(() => undefined);
      throw error;
    }
    if (article.coverPublicId) {
      await this.imageUploader
        .delete(article.coverPublicId)
        .catch(() => undefined);
    }
    return updated;
  }

  async listMine(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('فقط متخصص می‌تواند مقاله‌های خود را ببیند');
    }
    const items = await this.prisma.providerArticle.findMany({
      where: { providerProfileId: profile.id },
      select: MY_ARTICLE_FIELDS,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return {
      items: items.map((item) => ({
        ...item,
        categories: item.categories.map((link) => link.specialtyGroup),
        specialties: item.specialties.map((link) => link.specialty),
      })),
    };
  }

  async listPublic(query: ProviderArticleListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 10, 50);
    const where: Prisma.ProviderArticleWhereInput = {
      status: 'APPROVED',
      ...(query.categoryId
        ? { categories: { some: { specialtyGroupId: query.categoryId } } }
        : {}),
      ...(query.specialtyId
        ? { specialties: { some: { specialtyId: query.specialtyId } } }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                title: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                excerpt: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.providerArticle.findMany({
        where,
        select: PUBLIC_ARTICLE_FIELDS,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.providerArticle.count({ where }),
    ]);
    const ratings = await this.getRatingSummaries(items.map((item) => item.id));
    return {
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        excerpt: item.excerpt,
        content: item.content,
        coverImage: item.coverImage,
        coverAlt: item.coverAlt,
        readingMinutes: item.readingMinutes,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        authorName: item.providerProfile.user.name,
        categories: item.categories.map((link) => link.specialtyGroup),
        specialties: item.specialties.map((link) => link.specialty),
        ratingSummary: ratings.get(item.id) ?? { average: null, count: 0 },
      })),
      total,
      page,
      pageSize,
    };
  }

  async getPublic(slug: string) {
    const article = await this.prisma.providerArticle.findFirst({
      where: { slug, status: 'APPROVED' },
      select: PUBLIC_ARTICLE_FIELDS,
    });
    if (!article) throw new NotFoundException('مقاله پیدا نشد');
    const ratings = await this.getRatingSummaries([article.id]);
    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      coverImage: article.coverImage,
      coverAlt: article.coverAlt,
      readingMinutes: article.readingMinutes,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      authorName: article.providerProfile.user.name,
      categories: article.categories.map((link) => link.specialtyGroup),
      specialties: article.specialties.map((link) => link.specialty),
      ratingSummary: ratings.get(article.id) ?? { average: null, count: 0 },
    };
  }

  async listAdmin(query: AdminProviderArticleListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 10, 50);
    const where: Prisma.ProviderArticleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId
        ? { categories: { some: { specialtyGroupId: query.categoryId } } }
        : {}),
      ...(query.specialtyId
        ? { specialties: { some: { specialtyId: query.specialtyId } } }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { slug: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.providerArticle.findMany({
        where,
        select: ARTICLE_FIELDS,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.providerArticle.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async review(
    id: string,
    adminUserId: string,
    input: ReviewProviderArticleDto,
  ) {
    if (input.decision === 'REJECT' && !input.reviewNote?.trim()) {
      throw new BadRequestException('برای رد مقاله باید دلیل ثبت شود');
    }
    if (input.decision === 'APPROVE') {
      const article = await this.prisma.providerArticle.findUnique({
        where: { id },
        select: { id: true, status: true, coverImage: true },
      });
      if (!article) throw new NotFoundException('مقاله پیدا نشد');
      if (article.status !== 'PENDING_REVIEW') {
        throw new ConflictException('این مقاله در انتظار بررسی نیست');
      }
      if (!article.coverImage) {
        throw new BadRequestException(
          'پیش از تأیید، متخصص باید تصویر کاور مقاله را بارگذاری کند',
        );
      }
    }
    const result = await this.prisma.providerArticle.updateMany({
      where: {
        id,
        status: 'PENDING_REVIEW',
        ...(input.decision === 'APPROVE' ? { coverImage: { not: null } } : {}),
      },
      data: {
        status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewNote: input.reviewNote?.trim() || null,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        publishedAt: input.decision === 'APPROVE' ? new Date() : null,
      },
    });
    if (!result.count) {
      const exists = await this.prisma.providerArticle.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('مقاله پیدا نشد');
      throw new ConflictException('این مقاله در انتظار بررسی نیست');
    }
    return this.prisma.providerArticle.findUniqueOrThrow({
      where: { id },
      select: ARTICLE_FIELDS,
    });
  }

  async rate(articleId: string, userId: string, input: RateProviderArticleDto) {
    const article = await this.prisma.providerArticle.findFirst({
      where: { id: articleId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('مقاله پیدا نشد');
    try {
      return await this.prisma.providerArticleRating.create({
        data: {
          articleId,
          userId,
          rating: input.rating,
          comment: input.comment?.trim() || null,
        },
        select: {
          id: true,
          articleId: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (prismaCode(error) === 'P2002') {
        throw new ConflictException('برای این مقاله قبلاً امتیاز ثبت کرده‌اید');
      }
      throw error;
    }
  }

  private validateArticle(input: SubmitProviderArticleDto) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
      throw new BadRequestException(
        'نشانی مقاله باید شامل حروف انگلیسی کوچک، عدد و خط تیره باشد',
      );
    }
    if (!input.title.trim() || !input.excerpt.trim()) {
      throw new BadRequestException('عنوان و خلاصه مقاله الزامی هستند');
    }
    const articleText = [
      input.title,
      input.excerpt,
      input.coverAlt ?? '',
      ...input.content.flatMap((block) => [
        block.text ?? '',
        ...(block.items ?? []),
      ]),
    ].join(' ');
    if (containsContactInformation(articleText)) {
      throw new BadRequestException(
        'ثبت شماره تماس یا ایمیل در مقاله آموزشی مجاز نیست',
      );
    }
    if (!input.content.length) {
      throw new BadRequestException('متن مقاله نمی‌تواند خالی باشد');
    }
    for (const block of input.content) {
      if (block.type === 'list') {
        if (!block.items?.length || block.items.some((item) => !item.trim())) {
          throw new BadRequestException('فهرست مقاله نمی‌تواند خالی باشد');
        }
      } else if (!block.text?.trim()) {
        throw new BadRequestException('بلوک متنی مقاله نمی‌تواند خالی باشد');
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
  }

  private async validateTaxonomy(input: SubmitProviderArticleDto) {
    const categoryIds = input.categoryIds ?? [];
    const [categories, specialties] = await Promise.all([
      categoryIds.length
        ? this.prisma.specialtyGroup.findMany({
            where: { id: { in: categoryIds }, isActive: true },
            select: { id: true },
          })
        : [],
      this.prisma.specialty.findMany({
        where: { id: { in: input.specialtyIds }, isActive: true },
        select: { id: true, groupId: true },
      }),
    ]);
    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('دسته‌بندی انتخاب‌شده معتبر نیست');
    }
    if (specialties.length !== input.specialtyIds.length) {
      throw new BadRequestException('نیازمندی یا تخصص انتخاب‌شده معتبر نیست');
    }
    if (
      categoryIds.length &&
      specialties.some((specialty) => !categoryIds.includes(specialty.groupId))
    ) {
      throw new BadRequestException(
        'هر تخصص باید به یکی از دسته‌بندی‌های انتخاب‌شده تعلق داشته باشد',
      );
    }
  }

  private async getRatingSummaries(articleIds: string[]) {
    if (!articleIds.length) return new Map();
    const rows = await this.prisma.providerArticleRating.groupBy({
      by: ['articleId'],
      where: { articleId: { in: articleIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(
      rows.map((row) => [
        row.articleId,
        { average: row._avg.rating, count: row._count._all },
      ]),
    );
  }
}
