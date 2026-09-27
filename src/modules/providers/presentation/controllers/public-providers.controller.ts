import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

@ApiTags('Public Providers')
@Controller('public/providers')
export class PublicProvidersController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Browse approved providers' })
  @Get()
  async list(
    @Query('latitude') latitudeText?: string,
    @Query('longitude') longitudeText?: string,
  ) {
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
    const providers = await this.prisma.providerProfile.findMany({
      where: { verificationStatus: 'APPROVED' },
      include: {
        user: { select: { name: true } },
        skills: { include: { skill: true } },
        portfolioItems: {
          include: { images: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [{ isAvailable: 'desc' }, { rating: 'desc' }],
    });
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
    return results;
  }

  @ApiOperation({ summary: 'Get an approved provider profile' })
  @Get(':providerProfileId')
  async getOne(@Param('providerProfileId') providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findFirst({
      where: { id: providerProfileId, verificationStatus: 'APPROVED' },
      include: {
        user: { select: { name: true } },
        skills: { include: { skill: true } },
        workingHours: true,
        portfolioItems: {
          include: { images: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!provider) throw new NotFoundException('متخصص پیدا نشد');
    return this.toPublicProfile(provider);
  }

  private toPublicProfile(provider: any) {
    return {
      id: provider.id,
      name: provider.user.name,
      bio: provider.bio,
      rating: provider.rating,
      verified: provider.isVerified,
      available: provider.isAvailable,
      avatarUrl: provider.avatarUrl,
      hasServiceArea:
        provider.serviceAreaLatitude !== null &&
        provider.serviceAreaLongitude !== null,
      skills: provider.skills.map((item: any) => ({
        id: item.skill.id,
        name: item.skill.name,
      })),
      workingHours: provider.workingHours ?? [],
      portfolio: (provider.portfolioItems ?? []).flatMap((item: any) =>
        item.images.map((image: any) => image.url),
      ),
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
