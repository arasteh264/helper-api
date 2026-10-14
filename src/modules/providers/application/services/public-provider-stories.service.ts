import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface PublicStoryViewDto {
  storyId: string;
  ipAddress: string;
}

export interface PublicStoryResponseDto {
  id: string;
  title: string;
  description?: string;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  specialtyId?: string;
  specialtyName?: string;
  specialtySlug?: string;
  specialtyGroupName?: string;
  overlayText?: string;
  overlayColor: string;
  overlayFontSize: number;
  overlayPositionX: number;
  overlayPositionY: number;
  providerName: string;
  providerAvatarUrl?: string;
  providerId: string;
  createdAt: Date;
}

export interface PublicProviderStoriesDto {
  providerId: string;
  providerName: string;
  stories: PublicStoryResponseDto[];
}

function getPublicStoryWhere(): Prisma.ProviderStoryWhereInput {
  return {
    status: 'APPROVED',
    expiresAt: { gt: new Date() },
    OR: [{ isPaid: false }, { payments: { some: { status: 'PAID' } } }],
  };
}

@Injectable()
export class PublicProviderStoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProviderStories(
    providerId: string,
  ): Promise<PublicProviderStoriesDto> {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: {
        avatarUrl: true,
        user: { select: { name: true } },
      },
    });
    if (!provider) throw new NotFoundException('متخصص پیدا نشد');

    const stories = await this.prisma.providerStory.findMany({
      where: { ...getPublicStoryWhere(), providerProfileId: providerId },
      orderBy: { createdAt: 'desc' },
      include: { specialty: { include: { group: true } } },
    });
    return {
      providerId,
      providerName: provider.user.name,
      stories: stories.map((story) =>
        this.toResponse(story, provider.user.name, provider.avatarUrl),
      ),
    };
  }

  async recordStoryView(dto: PublicStoryViewDto): Promise<void> {
    await this.prisma.$transaction(
      async (db) => {
        const story = await db.providerStory.findFirst({
          where: {
            id: dto.storyId,
            ...getPublicStoryWhere(),
          },
          select: { id: true },
        });
        if (!story) throw new NotFoundException('داستان منتشرشده پیدا نشد');
        const unique = !(await db.providerStoryView.findFirst({
          where: {
            storyId: story.id,
            viewerType: 'GUEST',
            ipAddress: dto.ipAddress,
          },
          select: { id: true },
        }));
        await db.providerStoryView.create({
          data: {
            storyId: story.id,
            viewerType: 'GUEST',
            ipAddress: dto.ipAddress,
          },
        });
        await db.providerStoryStat.upsert({
          where: { storyId: story.id },
          create: { storyId: story.id, viewsCount: 1, uniqueViewers: 1 },
          update: {
            viewsCount: { increment: 1 },
            ...(unique && { uniqueViewers: { increment: 1 } }),
            lastUpdatedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getRecentStories(limit = 20): Promise<PublicStoryResponseDto[]> {
    const stories = await this.prisma.providerStory.findMany({
      where: getPublicStoryWhere(),
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: {
        providerProfile: {
          select: {
            avatarUrl: true,
            user: { select: { name: true } },
          },
        },
        specialty: { include: { group: true } },
      },
    });
    return stories.map((story) =>
      this.toResponse(
        story,
        story.providerProfile.user.name,
        story.providerProfile.avatarUrl,
      ),
    );
  }

  private toResponse(
    story: {
      id: string;
      title: string;
      description: string | null;
      mediaType: string;
      mediaUrl: string;
      thumbnailUrl: string | null;
      durationSeconds: number | null;
      providerProfileId: string;
      createdAt: Date;
      specialty: {
        id: string;
        name: string;
        slug: string;
        group: { name: string };
      } | null;
      overlayText: string | null;
      overlayColor: string;
      overlayFontSize: number;
      overlayPositionX: number;
      overlayPositionY: number;
    },
    providerName: string,
    providerAvatarUrl: string | null,
  ): PublicStoryResponseDto {
    return {
      id: story.id,
      title: story.title,
      description: story.description ?? undefined,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl,
      thumbnailUrl: story.thumbnailUrl ?? undefined,
      durationSeconds: story.durationSeconds ?? undefined,
      specialtyId: story.specialty?.id,
      specialtyName: story.specialty?.name,
      specialtySlug: story.specialty?.slug,
      specialtyGroupName: story.specialty?.group.name,
      overlayText: story.overlayText ?? undefined,
      overlayColor: story.overlayColor,
      overlayFontSize: story.overlayFontSize,
      overlayPositionX: story.overlayPositionX,
      overlayPositionY: story.overlayPositionY,
      providerName,
      providerAvatarUrl: providerAvatarUrl ?? undefined,
      providerId: story.providerProfileId,
      createdAt: story.createdAt,
    };
  }
}
