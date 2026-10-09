import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const publicProviderListInclude = {
  user: { select: { name: true } },
  skills: { include: { skill: true } },
  specialties: { include: { specialty: { include: { group: true } } } },
  portfolioItems: {
    include: { images: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  },
  _count: {
    select: {
      acceptedServiceRequests: { where: { status: 'COMPLETED' } },
      reviews: true,
    },
  },
} as const;

const publicProviderDetailInclude = {
  ...publicProviderListInclude,
  reviews: {
    include: {
      customer: { select: { name: true } },
      serviceRequest: {
        select: { specialty: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  },
} as const;

const publicProviderWhere = {
  verificationStatus: 'APPROVED',
  isAvailable: true,
  providerAddress: { not: null },
} as const;

const findPublicProviders = (
  prisma: PrismaService,
  pagination?: { skip: number; take: number },
) =>
  prisma.providerProfile.findMany({
    where: publicProviderWhere,
    include: publicProviderListInclude,
    orderBy: [{ isAvailable: 'desc' }, { rating: 'desc' }],
    ...(pagination ?? {}),
  });

const findPublicProvider = (prisma: PrismaService, providerProfileId: string) =>
  prisma.providerProfile.findFirst({
    where: {
      id: providerProfileId,
      verificationStatus: 'APPROVED',
    },
    include: publicProviderDetailInclude,
  });

type PublicProvider =
  | Awaited<ReturnType<typeof findPublicProviders>>[number]
  | NonNullable<Awaited<ReturnType<typeof findPublicProvider>>>;

@ApiTags('Public Providers')
@Controller('public/providers')
export class PublicProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Browse approved providers' })
  @Get()
  async list(
    @Query('latitude') latitudeText?: string,
    @Query('longitude') longitudeText?: string,
    @Query('page') pageText?: string,
    @Query('pageSize') pageSizeText?: string,
  ) {
    const isPaginated = pageText !== undefined || pageSizeText !== undefined;
    const page = pageText === undefined ? 1 : Number(pageText);
    const pageSize = pageSizeText === undefined ? 24 : Number(pageSizeText);
    if (
      isPaginated &&
      (!Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100)
    ) {
      throw new BadRequestException('شماره یا اندازه صفحه معتبر نیست');
    }

    const latitude = latitudeText === undefined ? null : Number(latitudeText);
    const longitude =
      longitudeText === undefined ? null : Number(longitudeText);
    const hasValidLocation =
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
    if (isPaginated && hasValidLocation) {
      throw new BadRequestException(
        'صفحه‌بندی و مرتب‌سازی بر اساس موقعیت را نمی‌توان هم‌زمان استفاده کرد',
      );
    }
    const [providers, total] = await Promise.all([
      findPublicProviders(
        this.prisma,
        isPaginated
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : undefined,
      ),
      isPaginated
        ? this.prisma.providerProfile.count({
            where: publicProviderWhere,
          })
        : Promise.resolve(0),
    ]);
    const results = providers.map((provider) => {
      const distanceKm =
        hasValidLocation &&
        provider.serviceAreaLatitude !== null &&
        provider.serviceAreaLongitude !== null
          ? this.distanceKm(
              latitude,
              longitude,
              provider.serviceAreaLatitude,
              provider.serviceAreaLongitude,
            )
          : null;
      return { ...this.toPublicProfile(provider), distanceKm };
    });
    if (hasValidLocation) {
      results.sort((left, right) => {
        if (left.distanceKm === null)
          return right.distanceKm === null ? right.rating - left.rating : 1;
        if (right.distanceKm === null) return -1;
        return left.distanceKm - right.distanceKm || right.rating - left.rating;
      });
    }
    return isPaginated ? { items: results, total, page, pageSize } : results;
  }

  @ApiOperation({ summary: 'Get an approved provider profile' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @Get(':providerProfileId')
  async getOne(
    @Param('providerProfileId') providerProfileId: string,
    @Query('latitude') latitudeText?: string,
    @Query('longitude') longitudeText?: string,
  ) {
    const hasLatitude = latitudeText !== undefined;
    const hasLongitude = longitudeText !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('موقعیت واردشده معتبر نیست');
    }

    const latitude = hasLatitude ? Number(latitudeText) : null;
    const longitude = hasLongitude ? Number(longitudeText) : null;
    if (
      latitude !== null &&
      longitude !== null &&
      (!Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180)
    ) {
      throw new BadRequestException('موقعیت واردشده معتبر نیست');
    }

    const provider = await findPublicProvider(this.prisma, providerProfileId);
    if (!provider) throw new NotFoundException('متخصص پیدا نشد');
    const distanceKm =
      latitude !== null &&
      longitude !== null &&
      provider.serviceAreaLatitude !== null &&
      provider.serviceAreaLongitude !== null
        ? this.distanceKm(
            latitude,
            longitude,
            provider.serviceAreaLatitude,
            provider.serviceAreaLongitude,
          )
        : null;
    return { ...this.toPublicProfile(provider), distanceKm };
  }

  private toPublicProfile(provider: PublicProvider) {
    return {
      id: provider.id,
      name: provider.user.name,
      bio: provider.bio,
      rating: provider.rating,
      reviewsCount: provider._count?.reviews ?? 0,
      completedJobs: provider._count?.acceptedServiceRequests ?? 0,
      verified: provider.isVerified,
      available: provider.isAvailable,
      avatarUrl: provider.avatarUrl,
      hasServiceArea:
        provider.serviceAreaLatitude !== null &&
        provider.serviceAreaLongitude !== null,
      serviceAreaRadiusKm: provider.serviceAreaRadiusKm,
      skills: provider.skills.map((item) => ({
        id: item.skill.id,
        name: item.skill.name,
      })),
      specialties: (provider.specialties ?? []).map((item) => ({
        id: item.specialty.id,
        name: item.specialty.name,
        slug: item.specialty.slug,
        icon: item.specialty.icon,
        groupId: item.specialty.groupId,
        groupName: item.specialty.group.name,
      })),
      portfolio: (provider.portfolioItems ?? []).flatMap((item) =>
        item.images.map((image) => image.url),
      ),
      reviews:
        'reviews' in provider
          ? provider.reviews.map((review) => ({
              id: review.id,
              customerName: review.customer.name,
              rating: review.rating,
              text: review.text ?? '',
              date: review.createdAt,
              service: review.serviceRequest.specialty?.name ?? 'خدمات عمومی',
            }))
          : [],
      createdAt: provider.createdAt,
    };
  }

  private distanceKm(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number,
  ) {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(latitudeB - latitudeA);
    const longitudeDelta = radians(longitudeB - longitudeA);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(latitudeA)) *
        Math.cos(radians(latitudeB)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return (
      Math.round(
        6371 *
          2 *
          Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) *
          10,
      ) / 10
    );
  }
}
