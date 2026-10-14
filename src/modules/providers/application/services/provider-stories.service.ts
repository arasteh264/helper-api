import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IMAGE_UPLOADER } from '../../../../shared/storage/image-uploader.token';
import type {
  SignedMediaUpload,
  StoryMediaUploader,
  UploadedImage,
} from '../../../../shared/storage/image-uploader.port';
import {
  CreateProviderStoryDto,
  ProviderStoryListResponseDto,
  ProviderStoryResponseDto,
  UpdateProviderStoryDto,
} from '../dto/provider-story.dto';

const MAX_VIDEO_SIZE_MB = 100;
const MAX_IMAGE_SIZE_MB = 15;

function getTehranDayStart(date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    timeZoneName: 'longOffset',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) throw new Error('Could not resolve the Asia/Tehran UTC offset');
  const offsetMinutes =
    (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));

  return new Date(
    Date.UTC(value('year'), value('month') - 1, value('day')) -
      offsetMinutes * 60_000,
  );
}

type StoryWithStats = Prisma.ProviderStoryGetPayload<{
  include: { stats: true; specialty: { include: { group: true } } };
}>;

@Injectable()
export class ProviderStoriesService {
  private readonly logger = new Logger(ProviderStoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(IMAGE_UPLOADER) private readonly mediaUploader: StoryMediaUploader,
  ) {}

  async createStory(
    userId: string,
    dto: CreateProviderStoryDto,
  ): Promise<ProviderStoryResponseDto> {
    const profile = await this.getAuthorizedProfile(userId);
    this.assertProviderSpecialty(profile, dto.specialtyId);
    const media = await this.getUploadedMedia(
      profile.id,
      dto.uploadedPublicId,
      dto.mediaType,
    );

    try {
      const story = await this.prisma.$transaction(async (db) => {
        await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${profile.id}))`;
        const todayStoryCount = await db.providerStory.count({
          where: {
            providerProfileId: profile.id,
            createdAt: { gte: getTehranDayStart() },
          },
        });
        if (todayStoryCount > 0) {
          throw new ConflictException(
            'هر متخصص در روز فقط می‌تواند یک داستان داشته باشد؛ برای ثبت داستان جدید، داستان امروز را حذف کنید',
          );
        }

        const created = await db.providerStory.create({
          data: {
            providerProfileId: profile.id,
            title: dto.title.trim(),
            description: dto.description?.trim() || null,
            specialtyId: dto.specialtyId ?? null,
            overlayText: dto.overlayText?.trim() || null,
            overlayColor: dto.overlayColor ?? '#ffffff',
            overlayFontSize: dto.overlayFontSize ?? 28,
            overlayPositionX: dto.overlayPositionX ?? 50,
            overlayPositionY: dto.overlayPositionY ?? 50,
            mediaType: dto.mediaType,
            mediaUrl: media.url,
            mediaPublicId: media.publicId,
            thumbnailUrl: media.thumbnailUrl,
            durationSeconds: media.durationSeconds
              ? Math.ceil(media.durationSeconds)
              : null,
            status: 'DRAFT',
            monetizationStatus: 'FREE',
          },
        });
        await db.providerStoryStat.create({ data: { storyId: created.id } });
        return db.providerStory.findUniqueOrThrow({
          where: { id: created.id },
          include: { stats: true, specialty: { include: { group: true } } },
        });
      });

      return this.mapToResponseDto(story, profile.canViewStoryStats);
    } catch (error) {
      this.logger.error(
        `Could not create story for provider ${profile.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.cleanupMedia(
        media.publicId,
        dto.mediaType.toLowerCase() as 'image' | 'video',
        `Could not clean up media after creating story for provider ${profile.id}`,
      );
      throw error;
    }
  }

  async updateStory(
    userId: string,
    storyId: string,
    dto: UpdateProviderStoryDto,
  ): Promise<ProviderStoryResponseDto> {
    const profile = await this.getAuthorizedProfile(userId);
    const story = await this.getOwnedEditableStory(profile.id, storyId);
    if (dto.specialtyId !== undefined) {
      this.assertProviderSpecialty(profile, dto.specialtyId);
    }
    if (Boolean(dto.uploadedPublicId) !== Boolean(dto.mediaType)) {
      throw new BadRequestException(
        'نوع رسانه و شناسه‌ی آپلود باید هم‌زمان ارسال شوند',
      );
    }
    const media =
      dto.uploadedPublicId && dto.mediaType
        ? await this.getUploadedMedia(
            profile.id,
            dto.uploadedPublicId,
            dto.mediaType,
          )
        : undefined;

    try {
      const updated = await this.prisma.providerStory.update({
        where: { id: storyId },
        data: {
          title: dto.title?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          specialtyId:
            dto.specialtyId === undefined ? undefined : dto.specialtyId || null,
          overlayText:
            dto.overlayText === undefined
              ? undefined
              : dto.overlayText.trim() || null,
          overlayColor: dto.overlayColor,
          overlayFontSize: dto.overlayFontSize,
          overlayPositionX: dto.overlayPositionX,
          overlayPositionY: dto.overlayPositionY,
          ...(media && {
            mediaType: dto.mediaType!,
            mediaUrl: media.url,
            mediaPublicId: media.publicId,
            thumbnailUrl: media.thumbnailUrl,
            thumbnailPublicId: null,
            durationSeconds: media.durationSeconds
              ? Math.ceil(media.durationSeconds)
              : null,
          }),
          status: story.status === 'REJECTED' ? 'DRAFT' : undefined,
          rejectionReason: story.status === 'REJECTED' ? null : undefined,
        },
        include: { stats: true, specialty: { include: { group: true } } },
      });

      if (media && story.mediaPublicId) {
        await this.cleanupMedia(
          story.mediaPublicId,
          story.mediaType.toLowerCase() as 'image' | 'video',
          `Story ${story.id} updated but prior media cleanup failed`,
        );
      }
      return this.mapToResponseDto(updated, profile.canViewStoryStats);
    } catch (error) {
      this.logger.error(
        `Could not update story ${story.id} for provider ${profile.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      if (media) {
        await this.cleanupMedia(
          media.publicId,
          dto.mediaType!.toLowerCase() as 'image' | 'video',
          `Could not clean up replacement media after updating story ${story.id}`,
        );
      }
      throw error;
    }
  }

  async submitStory(
    userId: string,
    storyId: string,
  ): Promise<ProviderStoryResponseDto> {
    const profile = await this.getAuthorizedProfile(userId);
    const story = await this.getOwnedEditableStory(profile.id, storyId);

    if (!story.title || !story.mediaUrl) {
      throw new BadRequestException('عنوان و فایل رسانه‌ای الزامی است');
    }

    const submitted = await this.prisma.providerStory.update({
      where: { id: storyId },
      data: {
        status: 'PENDING_REVIEW',
        submittedAt: new Date(),
        rejectionReason: null,
      },
      include: { stats: true, specialty: { include: { group: true } } },
    });
    return this.mapToResponseDto(submitted, profile.canViewStoryStats);
  }

  async getProviderStories(
    userId: string,
    page = 1,
    pageSize = 10,
  ): Promise<ProviderStoryListResponseDto> {
    const profile = await this.getAuthorizedProfile(userId);
    const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    const safePageSize =
      Number.isSafeInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, 50)
        : 10;
    const where = { providerProfileId: profile.id };
    const todayStart = getTehranDayStart();
    const [stories, total, todayStoryCount] = await Promise.all([
      this.prisma.providerStory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: { stats: true, specialty: { include: { group: true } } },
      }),
      this.prisma.providerStory.count({ where }),
      this.prisma.providerStory.count({
        where: {
          providerProfileId: profile.id,
          createdAt: { gte: todayStart },
        },
      }),
    ]);
    const configuration = await this.prisma.walletConfiguration.findUnique({
      where: { id: 'global' },
      select: { storyVideoMaxSizeMB: true },
    });

    return {
      stories: stories.map((story) =>
        this.mapToResponseDto(story, profile.canViewStoryStats),
      ),
      availableSpecialties: profile.specialties
        .filter(({ specialty }) => specialty.isActive)
        .map(({ specialty }) => ({
          id: specialty.id,
          name: specialty.name,
          slug: specialty.slug,
          groupName: specialty.group.name,
        })),
      videoMaxSizeMB: Math.min(
        configuration?.storyVideoMaxSizeMB ?? 100,
        MAX_VIDEO_SIZE_MB,
      ),
      canCreateStory: todayStoryCount === 0,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async getStoryStats(userId: string, storyId: string) {
    const profile = await this.getAuthorizedProfile(userId);
    if (!profile.canViewStoryStats) {
      throw new ForbiddenException(
        'نمایش آمار داستان هنوز توسط مدیر فعال نشده است',
      );
    }
    const story = await this.prisma.providerStory.findFirst({
      where: { id: storyId, providerProfileId: profile.id },
      include: { stats: true },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    return {
      storyId: story.id,
      viewsCount: story.stats?.viewsCount ?? 0,
      uniqueViewers: story.stats?.uniqueViewers ?? 0,
      lastUpdatedAt: story.stats?.lastUpdatedAt ?? story.createdAt,
    };
  }

  async prepareMediaUpload(
    userId: string,
    mediaType: 'IMAGE' | 'VIDEO',
  ): Promise<SignedMediaUpload & { maxSizeMB: number }> {
    const profile = await this.getAuthorizedProfile(userId);
    const resourceType = mediaType.toLowerCase() as 'image' | 'video';
    const settings =
      mediaType === 'VIDEO'
        ? await this.prisma.walletConfiguration.findUnique({
            where: { id: 'global' },
            select: { storyVideoMaxSizeMB: true },
          })
        : null;
    const maxSizeMB =
      mediaType === 'VIDEO'
        ? Math.min(settings?.storyVideoMaxSizeMB ?? 100, MAX_VIDEO_SIZE_MB)
        : MAX_IMAGE_SIZE_MB;
    try {
      return {
        ...this.mediaUploader.createSignedUpload(
          `provider-stories/${profile.id}`,
          randomUUID(),
          resourceType,
        ),
        maxSizeMB,
      };
    } catch (error) {
      this.logger.error(
        'Could not create provider story upload signature',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'سرویس بارگذاری روی سرور آماده نیست؛ تنظیمات Cloudinary را بررسی کنید.',
      );
    }
  }

  async payStory(userId: string, storyId: string) {
    const profile = await this.getAuthorizedProfile(userId);
    const story = await this.prisma.providerStory.findFirst({
      where: { id: storyId, providerProfileId: profile.id },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    if (story.status !== 'APPROVED' || !story.isPaid || !story.priceToman) {
      throw new BadRequestException(
        'این داستان در حال حاضر هزینه‌ی قابل پرداخت ندارد',
      );
    }

    const result = await this.prisma.$transaction(
      async (db) => {
        const existingPayment = await db.providerStoryPayment.findUnique({
          where: { storyId },
        });
        if (existingPayment?.status === 'PAID') {
          throw new ConflictException(
            'هزینه‌ی انتشار این داستان قبلاً پرداخت شده است',
          );
        }

        const wallet = await db.wallet.upsert({
          where: { providerProfileId: profile.id },
          create: { providerProfileId: profile.id },
          update: {},
        });
        const debit = await db.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: story.priceToman! } },
          data: { balance: { decrement: story.priceToman! } },
        });
        if (debit.count !== 1) {
          return { insufficientBalance: true as const };
        }

        const updatedWallet = await db.wallet.findUniqueOrThrow({
          where: { id: wallet.id },
        });
        const transaction = await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'STORY_PROMOTION',
            amount: -story.priceToman!,
            balanceAfter: updatedWallet.balance,
            description: `هزینه انتشار داستان: ${story.title}`,
          },
        });
        await db.providerStoryPayment.upsert({
          where: { storyId },
          create: {
            storyId,
            storyTitle: story.title,
            providerProfileId: profile.id,
            priceToman: story.priceToman!,
            paidByUserId: userId,
            walletTransactionId: transaction.id,
            status: 'PAID',
            approvedAt: new Date(),
          },
          update: {
            storyTitle: story.title,
            providerProfileId: profile.id,
            priceToman: story.priceToman!,
            paidByUserId: userId,
            walletTransactionId: transaction.id,
            status: 'PAID',
            approvedAt: new Date(),
          },
        });
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.providerStory.update({
          where: { id: storyId },
          data: { expiresAt, monetizationStatus: 'PAID' },
        });
        return {
          insufficientBalance: false as const,
          balance: updatedWallet.balance,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.insufficientBalance) {
      throw new BadRequestException(
        'موجودی کیف پول برای پرداخت هزینه‌ی انتشار کافی نیست',
      );
    }
    return { storyId, paid: true, balance: result.balance };
  }

  async deleteStory(userId: string, storyId: string): Promise<void> {
    const profile = await this.getAuthorizedProfile(userId);
    const story = await this.prisma.providerStory.findFirst({
      where: { id: storyId, providerProfileId: profile.id },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    if (story.mediaPublicId) {
      await this.mediaUploader.delete(
        story.mediaPublicId,
        story.mediaType.toLowerCase() as 'image' | 'video',
      );
    }
    await this.prisma.providerStory.delete({ where: { id: story.id } });
  }

  private async getAuthorizedProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        canPublishStories: true,
        canViewStoryStats: true,
        specialties: {
          select: {
            specialtyId: true,
            specialty: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                group: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!profile)
      throw new ForbiddenException('حساب متخصص برای این کار پیدا نشد');
    if (!profile.canPublishStories) {
      throw new ForbiddenException(
        'مدیر هنوز دسترسی انتشار داستان را برای شما فعال نکرده است',
      );
    }
    return profile;
  }

  private async getOwnedEditableStory(
    providerProfileId: string,
    storyId: string,
  ) {
    const story = await this.prisma.providerStory.findFirst({
      where: { id: storyId, providerProfileId },
    });
    if (!story) throw new NotFoundException('داستان پیدا نشد');
    if (!['DRAFT', 'REJECTED'].includes(story.status)) {
      throw new BadRequestException(
        'تنها پیش‌نویس یا داستان ردشده قابل ویرایش است',
      );
    }
    return story;
  }

  private assertProviderSpecialty(
    profile: Awaited<
      ReturnType<ProviderStoriesService['getAuthorizedProfile']>
    >,
    specialtyId?: string | null,
  ): void {
    if (
      specialtyId &&
      !profile.specialties.some(
        ({ specialty }) => specialty.id === specialtyId && specialty.isActive,
      )
    ) {
      throw new BadRequestException(
        'برچسب باید از تخصص‌های فعال خودتان انتخاب شود',
      );
    }
  }

  private async getUploadedMedia(
    providerProfileId: string,
    publicId: string,
    mediaType: 'IMAGE' | 'VIDEO',
  ): Promise<UploadedImage> {
    const resourceType = mediaType.toLowerCase() as 'image' | 'video';
    const expectedPrefix = `provider-stories/${providerProfileId}/`;
    if (
      !publicId.startsWith(expectedPrefix) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        publicId.slice(expectedPrefix.length),
      )
    ) {
      throw new BadRequestException('شناسه‌ی رسانه‌ی داستان معتبر نیست');
    }

    let uploaded: UploadedImage;
    try {
      uploaded = await this.mediaUploader.getUploaded(publicId, resourceType);
    } catch (error) {
      this.logger.warn(
        `Could not verify story media ${publicId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadRequestException(
        'فایل در فضای رسانه پیدا نشد؛ آن را دوباره انتخاب و آپلود کنید',
      );
    }

    const settings =
      mediaType === 'VIDEO'
        ? await this.prisma.walletConfiguration.findUnique({
            where: { id: 'global' },
            select: { storyVideoMaxSizeMB: true },
          })
        : null;
    const maxSizeMB =
      mediaType === 'VIDEO'
        ? Math.min(settings?.storyVideoMaxSizeMB ?? 100, MAX_VIDEO_SIZE_MB)
        : MAX_IMAGE_SIZE_MB;
    if ((uploaded.bytes ?? Number.MAX_SAFE_INTEGER) > maxSizeMB * 1024 * 1024) {
      await this.cleanupMedia(
        publicId,
        resourceType,
        `Could not remove oversized story media ${publicId}`,
      );
      throw new BadRequestException(
        `حجم رسانه نباید بیشتر از ${maxSizeMB} مگابایت باشد`,
      );
    }
    return uploaded;
  }

  private async cleanupMedia(
    publicId: string,
    type: 'image' | 'video',
    context: string,
  ): Promise<void> {
    try {
      await this.mediaUploader.delete(publicId, type);
    } catch (error) {
      this.logger.error(
        context,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private mapToResponseDto(
    story: StoryWithStats,
    canViewStats: boolean,
  ): ProviderStoryResponseDto {
    return {
      id: story.id,
      title: story.title,
      description: story.description ?? undefined,
      specialtyId: story.specialty?.id,
      specialtyName: story.specialty?.name,
      specialtySlug: story.specialty?.slug,
      specialtyGroupName: story.specialty?.group.name,
      overlayText: story.overlayText ?? undefined,
      overlayColor: story.overlayColor,
      overlayFontSize: story.overlayFontSize,
      overlayPositionX: story.overlayPositionX,
      overlayPositionY: story.overlayPositionY,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl,
      thumbnailUrl: story.thumbnailUrl ?? undefined,
      durationSeconds: story.durationSeconds ?? undefined,
      status: story.status,
      isPaid: story.isPaid,
      priceToman: story.priceToman ?? undefined,
      monetizationStatus: story.monetizationStatus,
      submittedAt: story.submittedAt ?? undefined,
      reviewedAt: story.reviewedAt ?? undefined,
      rejectionReason: story.rejectionReason ?? undefined,
      expiresAt: story.expiresAt ?? undefined,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      ...(canViewStats && {
        viewsCount: story.stats?.viewsCount ?? 0,
        uniqueViewers: story.stats?.uniqueViewers ?? 0,
      }),
    };
  }
}
