import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IMAGE_UPLOADER } from '../../../../shared/storage/image-uploader.token';
import type { ImageUploader } from '../../../../shared/storage/image-uploader.port';
import { Inject } from '@nestjs/common';

export class ApproveProviderStoryDto {
  comment?: string;
}

export class RejectProviderStoryDto {
  rejectionReason: string;
}

export class SetStorePricingDto {
  priceToman: number;
  isPaid: boolean;
}

export class SetProviderStoryAccessDto {
  canPublishStories: boolean;
  canViewStoryStats: boolean;
}

export interface AdminStoryListFilter {
  status?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  page?: number;
  pageSize?: number;
}

export interface StoryApprovalResponseDto {
  id: string;
  title: string;
  description: string | null;
  providerName: string;
  providerProfileId: string;
  status: string;
  submittedAt: Date | null;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  specialtyName: string | null;
  specialtySlug: string | null;
  specialtyGroupName: string | null;
  overlayText: string | null;
  overlayColor: string;
  overlayFontSize: number;
  overlayPositionX: number;
  overlayPositionY: number;
  viewsCount: number;
  uniqueViewers: number;
  isPaid: boolean;
  priceToman: number | null;
  paymentStatus: string | null;
  monetizationStatus: string;
  expiresAt: Date | null;
}

export interface AdminStoryListResponseDto {
  stories: StoryApprovalResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProviderStoryAccessItem {
  providerProfileId: string;
  providerName: string;
  email: string;
  isVerified: boolean;
  canPublishStories: boolean;
  canViewStoryStats: boolean;
}

export interface StoryFinancialReportDto {
  paidStoriesCount: number;
  freeStoriesCount: number;
  totalRevenueFromStories: number;
  pendingApprovalCount: number;
  totalViewsAcrossStories: number;
}

const MAX_PAGE_SIZE = 100;

@Injectable()
export class AdminProviderStoriesService {
  private readonly logger = new Logger(AdminProviderStoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_UPLOADER) private readonly mediaUploader: ImageUploader,
  ) {}

  async getStories(
    filter: AdminStoryListFilter,
  ): Promise<AdminStoryListResponseDto> {
    const page =
      Number.isSafeInteger(filter.page) && (filter.page ?? 0) > 0
        ? filter.page!
        : 1;
    const pageSize =
      Number.isSafeInteger(filter.pageSize) && (filter.pageSize ?? 0) > 0
        ? Math.min(filter.pageSize!, MAX_PAGE_SIZE)
        : 20;
    const where: Prisma.ProviderStoryWhereInput = filter.status
      ? { status: filter.status }
      : { status: 'PENDING_REVIEW' };

    const [stories, total] = await Promise.all([
      this.prisma.providerStory.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          providerProfile: { include: { user: { select: { name: true } } } },
          stats: true,
          specialty: { include: { group: true } },
          payments: {
            where: { status: 'PAID' },
            select: { status: true },
            take: 1,
          },
        },
      }),
      this.prisma.providerStory.count({ where }),
    ]);

    return {
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        description: story.description,
        providerName: story.providerProfile.user.name,
        providerProfileId: story.providerProfileId,
        status: story.status,
        submittedAt: story.submittedAt,
        mediaType: story.mediaType,
        mediaUrl: story.mediaUrl,
        thumbnailUrl: story.thumbnailUrl,
        durationSeconds: story.durationSeconds,
        specialtyName: story.specialty?.name ?? null,
        specialtySlug: story.specialty?.slug ?? null,
        specialtyGroupName: story.specialty?.group.name ?? null,
        overlayText: story.overlayText,
        overlayColor: story.overlayColor,
        overlayFontSize: story.overlayFontSize,
        overlayPositionX: story.overlayPositionX,
        overlayPositionY: story.overlayPositionY,
        viewsCount: story.stats?.viewsCount ?? 0,
        uniqueViewers: story.stats?.uniqueViewers ?? 0,
        isPaid: story.isPaid,
        priceToman: story.priceToman,
        paymentStatus: story.payments[0]?.status ?? null,
        monetizationStatus: story.monetizationStatus,
        expiresAt: story.expiresAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async listProviderAccess(page = 1, pageSize = 20, search?: string) {
    const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    const safePageSize =
      Number.isSafeInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : 20;
    const normalizedSearch = search?.trim();
    const where: Prisma.ProviderProfileWhereInput = {
      user: {
        role: 'PROVIDER',
        ...(normalizedSearch
          ? {
              OR: [
                { name: { contains: normalizedSearch, mode: 'insensitive' } },
                { email: { contains: normalizedSearch, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };
    const [profiles, total] = await Promise.all([
      this.prisma.providerProfile.findMany({
        where,
        select: {
          id: true,
          isVerified: true,
          canPublishStories: true,
          canViewStoryStats: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.providerProfile.count({ where }),
    ]);
    return {
      items: profiles.map((profile) => ({
        providerProfileId: profile.id,
        providerName: profile.user.name,
        email: profile.user.email,
        isVerified: profile.isVerified,
        canPublishStories: profile.canPublishStories,
        canViewStoryStats: profile.canViewStoryStats,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async setProviderAccess(
    providerProfileId: string,
    adminId: string,
    dto: SetProviderStoryAccessDto,
  ) {
    const before = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: {
        id: true,
        canPublishStories: true,
        canViewStoryStats: true,
      },
    });
    if (!before) throw new NotFoundException('پروفایل متخصص پیدا نشد');

    const result = await this.prisma.$transaction(async (db) => {
      const updated = await db.providerProfile.update({
        where: { id: providerProfileId },
        data: dto,
        select: {
          id: true,
          canPublishStories: true,
          canViewStoryStats: true,
        },
      });
      await db.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          action: 'PROVIDER_STORY_ACCESS_UPDATED',
          targetType: 'ProviderProfile',
          targetId: providerProfileId,
          reason: 'Story publishing and view-stat permissions changed',
          beforeState: {
            canPublishStories: before.canPublishStories,
            canViewStoryStats: before.canViewStoryStats,
          },
          afterState: {
            canPublishStories: updated.canPublishStories,
            canViewStoryStats: updated.canViewStoryStats,
          },
        },
      });
      return updated;
    });
    return result;
  }

  async approveStory(
    storyId: string,
    adminId: string,
    dto: ApproveProviderStoryDto,
  ) {
    const story = await this.prisma.providerStory.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    if (story.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        'فقط داستان‌های در انتظار بررسی قابل تأیید هستند',
      );
    }
    const expiresAt = story.isPaid
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.prisma.$transaction(async (db) => {
      const changed = await db.providerStory.updateMany({
        where: { id: storyId, status: 'PENDING_REVIEW' },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedByAdminId: adminId,
          expiresAt,
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'وضعیت داستان تغییر کرده است؛ صفحه را تازه‌سازی کنید',
        );
      }
      await db.providerStoryApprovalLog.create({
        data: {
          storyId,
          adminId,
          action: 'APPROVE',
          comment: dto.comment?.trim() || null,
        },
      });
      return db.providerStory.findUniqueOrThrow({
        where: { id: storyId },
        include: { stats: true },
      });
    });
  }

  async rejectStory(
    storyId: string,
    adminId: string,
    dto: RejectProviderStoryDto,
  ) {
    const reason = dto.rejectionReason?.trim();
    if (!reason) throw new BadRequestException('دلیل رد داستان الزامی است');
    const changed = await this.prisma.$transaction(async (db) => {
      const result = await db.providerStory.updateMany({
        where: { id: storyId, status: 'PENDING_REVIEW' },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedByAdminId: adminId,
          rejectionReason: reason,
          expiresAt: null,
        },
      });
      if (result.count !== 1) {
        const exists = await db.providerStory.findUnique({
          where: { id: storyId },
        });
        if (!exists) throw new NotFoundException('داستان پیدا نشد');
        throw new ConflictException(
          'وضعیت داستان تغییر کرده است؛ صفحه را تازه‌سازی کنید',
        );
      }
      await db.providerStoryApprovalLog.create({
        data: { storyId, adminId, action: 'REJECT', comment: reason },
      });
      return db.providerStory.findUniqueOrThrow({ where: { id: storyId } });
    });
    return changed;
  }

  async setStoryPricing(
    storyId: string,
    adminId: string,
    dto: SetStorePricingDto,
  ) {
    if (typeof dto.isPaid !== 'boolean') {
      throw new BadRequestException(
        'وضعیت رایگان یا پولی بودن داستان معتبر نیست',
      );
    }
    if (
      dto.isPaid &&
      (dto.priceToman === undefined ||
        !Number.isSafeInteger(dto.priceToman) ||
        dto.priceToman <= 0)
    ) {
      throw new BadRequestException(
        'برای داستان پولی مبلغ صحیح و بیشتر از صفر وارد کنید',
      );
    }
    const story = await this.prisma.providerStory.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    const payment = await this.prisma.providerStoryPayment.findUnique({
      where: { storyId },
      select: { status: true },
    });
    if (dto.isPaid && payment?.status === 'PAID') {
      throw new ConflictException(
        'بعد از پرداخت، تغییر قیمت داستان امکان‌پذیر نیست',
      );
    }

    return this.prisma.$transaction(async (db) => {
      const updated = await db.providerStory.update({
        where: { id: storyId },
        data: {
          isPaid: dto.isPaid,
          priceToman: dto.isPaid ? dto.priceToman : null,
          monetizationStatus: dto.isPaid ? 'PAYMENT_REQUIRED' : 'FREE',
          ...(!dto.isPaid &&
            story.status === 'APPROVED' &&
            !story.expiresAt && {
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            }),
          ...(dto.isPaid && { expiresAt: null }),
        },
      });
      await db.providerStoryApprovalLog.create({
        data: {
          storyId,
          adminId,
          action: 'SET_PRICING',
          comment: dto.isPaid
            ? `هزینه انتشار: ${dto.priceToman.toLocaleString('fa-IR')} تومان`
            : 'انتشار رایگان شد',
        },
      });
      return updated;
    });
  }

  async getFinancialReport(): Promise<StoryFinancialReportDto> {
    const [paid, freeStories, pendingStories, allStats] = await Promise.all([
      this.prisma.providerStoryPayment.aggregate({
        where: { status: 'PAID' },
        _count: { _all: true },
        _sum: { priceToman: true },
      }),
      this.prisma.providerStory.count({
        where: { isPaid: false, status: 'APPROVED' },
      }),
      this.prisma.providerStory.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.providerStoryStat.aggregate({ _sum: { viewsCount: true } }),
    ]);
    return {
      paidStoriesCount: paid._count._all,
      freeStoriesCount: freeStories,
      totalRevenueFromStories: paid._sum.priceToman ?? 0,
      pendingApprovalCount: pendingStories,
      totalViewsAcrossStories: allStats._sum.viewsCount ?? 0,
    };
  }

  async getStoryUploadSettings() {
    const configuration = await this.prisma.walletConfiguration.findUnique({
      where: { id: 'global' },
      select: { storyVideoMaxSizeMB: true },
    });
    return {
      videoMaxSizeMB: Math.min(configuration?.storyVideoMaxSizeMB ?? 100, 100),
    };
  }

  async setStoryUploadSettings(videoMaxSizeMB: number, adminId: string) {
    if (
      !Number.isSafeInteger(videoMaxSizeMB) ||
      videoMaxSizeMB < 1 ||
      videoMaxSizeMB > 100
    ) {
      throw new BadRequestException(
        'حداکثر حجم ویدیو باید بین ۱ تا ۱۰۰ مگابایت باشد',
      );
    }
    const updated = await this.prisma.$transaction(async (db) => {
      const settings = await db.walletConfiguration.upsert({
        where: { id: 'global' },
        create: { id: 'global', storyVideoMaxSizeMB: videoMaxSizeMB },
        update: { storyVideoMaxSizeMB: videoMaxSizeMB },
        select: { storyVideoMaxSizeMB: true },
      });
      await db.adminAuditLog.create({
        data: {
          actorUserId: adminId,
          action: 'PROVIDER_STORY_UPLOAD_LIMIT_UPDATED',
          targetType: 'PLATFORM_SETTING',
          targetId: 'provider-story-upload-limit',
          reason: `storyVideoMaxSizeMB=${videoMaxSizeMB}`,
          afterState: settings,
        },
      });
      return settings;
    });
    return { videoMaxSizeMB: updated.storyVideoMaxSizeMB };
  }

  async getStoryApprovalLog(storyId: string) {
    const exists = await this.prisma.providerStory.findUnique({
      where: { id: storyId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('داستان پیدا نشد');
    return this.prisma.providerStoryApprovalLog.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { name: true } } },
    });
  }

  async expireStories(): Promise<number> {
    const expired = await this.prisma.providerStory.findMany({
      where: { status: 'APPROVED', expiresAt: { lte: new Date() } },
      select: { id: true, mediaPublicId: true, mediaType: true },
    });
    let deletedCount = 0;
    for (const story of expired) {
      try {
        if (story.mediaPublicId) {
          await this.mediaUploader.delete(
            story.mediaPublicId,
            story.mediaType.toLowerCase() as 'image' | 'video',
          );
        }
        await this.prisma.providerStory.delete({ where: { id: story.id } });
        deletedCount += 1;
      } catch (error) {
        this.logger.error(
          `Could not expire and remove story ${story.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return deletedCount;
  }
}
