import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { CreateServiceRequestUseCase } from '../../application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from '../../application/add-skill-to-request.use-case';
import { UploadServiceRequestImageUseCase } from '../../application/upload-service-request-image.use-case';
import { CreateServiceRequestDto } from '../../application/dto/create-service-request.dto';
import { AddSkillToRequestDto } from '../../application/dto/add-skill-to-request.dto';
import { ServiceRequestResponseDto } from '../../application/dto/service-request-response.dto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { InviteProviderDto } from '../../application/dto/invite-provider.dto';
import { ListMyServiceRequestsUseCase } from '../../../../modules/customers/application/list-my-service-requests.use-case';
import { MatchProvidersForRequestUseCase } from '../../../../modules/matching/application/match-providers-for-request.use-case';
import { Logger } from '@nestjs/common';
import { CreateServiceRequestReviewDto } from '../../application/dto/create-service-request-review.dto';
import { MyServiceRequestsQueryDto } from '../../../../modules/customers/application/dto/my-service-requests-query.dto';
import { UpdateServiceRequestDto } from '../../application/dto/update-service-request.dto';

function isUniqueConstraintError(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    error.constructor.name !== 'PrismaClientKnownRequestError'
  ) {
    return false;
  }
  const codeDescriptor = Object.getOwnPropertyDescriptor(error, 'code');
  return (
    typeof codeDescriptor?.value === 'string' &&
    codeDescriptor.value === 'P2002'
  );
}
@ApiTags('Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('service-requests')
export class ServiceRequestController {
  private readonly logger = new Logger(ServiceRequestController.name);
  constructor(
    private readonly createServiceRequestUseCase: CreateServiceRequestUseCase,
    private readonly addSkillToRequestUseCase: AddSkillToRequestUseCase,
    private readonly uploadServiceRequestImageUseCase: UploadServiceRequestImageUseCase,
    private readonly prisma: PrismaService,
    private readonly listMyRequests: ListMyServiceRequestsUseCase,
    private readonly matchProviders: MatchProvidersForRequestUseCase,
  ) {}

  @Get('mine')
  getMine(
    @CurrentUser() currentUser: TokenPayload,
    @Query() query: MyServiceRequestsQueryDto,
  ) {
    return this.listMyRequests.executePage(currentUser.userId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      group: query.group ?? 'active',
    });
  }

  @ApiOperation({
    summary: 'Get matching available specialists ordered by distance',
  })
  @Get(':id/matches')
  async getMatches(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
  ) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, customerId: currentUser.userId },
      include: { skills: { select: { skillId: true } } },
    });
    if (!request) throw new NotFoundException('درخواست پیدا نشد');

    const skillIds = request.skills.map((item) => item.skillId);
    if (!skillIds.length && !request.specialtyId) return [];

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED',
        isAvailable: true,
        userId: { not: currentUser.userId },
        OR: [
          ...(request.specialtyId
            ? [{ specialties: { some: { specialtyId: request.specialtyId } } }]
            : []),
          ...(skillIds.length
            ? [{ skills: { some: { skillId: { in: skillIds } } } }]
            : []),
        ],
      },
      include: {
        user: { select: { name: true } },
        skills: { include: { skill: true } },
        specialties: { include: { specialty: { include: { group: true } } } },
      },
    });

    return providers
      .map((provider) => ({
        id: provider.id,
        name: provider.user.name,
        rating: provider.rating,
        verified: provider.isVerified,
        avatarUrl: provider.avatarUrl,
        skills: provider.skills.map((item) => item.skill.name),
        specialties: provider.specialties.map((item) => ({
          id: item.specialty.id,
          name: item.specialty.name,
          groupName: item.specialty.group.name,
        })),
        distanceKm:
          request.latitude !== null &&
          request.longitude !== null &&
          provider.serviceAreaLatitude !== null &&
          provider.serviceAreaLongitude !== null
            ? Math.round(
                this.distanceKm(
                  request.latitude,
                  request.longitude,
                  provider.serviceAreaLatitude,
                  provider.serviceAreaLongitude,
                ) * 10,
              ) / 10
            : null,
      }))
      .sort((left, right) => {
        if (left.distanceKm === null)
          return right.distanceKm === null ? right.rating - left.rating : 1;
        if (right.distanceKm === null) return -1;
        return left.distanceKm - right.distanceKm || right.rating - left.rating;
      });
  }

  @ApiOperation({ summary: 'Invite a selected specialist to this request' })
  @Post(':id/invitations')
  async inviteProvider(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
    @Body() dto: InviteProviderDto,
  ) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, customerId: currentUser.userId, status: 'OPEN' },
      include: { skills: { select: { skillId: true } } },
    });
    if (!request) throw new NotFoundException('درخواست باز پیدا نشد');

    const skillIds = request.skills.map((item) => item.skillId);
    if (!skillIds.length && !request.specialtyId) {
      throw new NotFoundException('برای این درخواست تخصصی ثبت نشده است');
    }

    const provider = await this.prisma.providerProfile.findFirst({
      where: {
        id: dto.providerProfileId,
        verificationStatus: 'APPROVED',
        isAvailable: true,
        userId: { not: currentUser.userId },
        OR: [
          ...(request.specialtyId
            ? [{ specialties: { some: { specialtyId: request.specialtyId } } }]
            : []),
          ...(skillIds.length
            ? [{ skills: { some: { skillId: { in: skillIds } } } }]
            : []),
        ],
      },
      select: { id: true },
    });
    if (!provider)
      throw new NotFoundException('متخصص در دسترس این درخواست نیست');

    return this.prisma.providerRequestInvitation.upsert({
      where: {
        providerProfileId_serviceRequestId: {
          providerProfileId: provider.id,
          serviceRequestId: request.id,
        },
      },
      update: { status: 'PENDING', respondedAt: null },
      create: {
        providerProfileId: provider.id,
        serviceRequestId: request.id,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  @ApiOperation({ summary: 'Get a request I own' })
  @Get(':id')
  async getMineById(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        specialty: { select: { name: true } },
        images: true,
        acceptedProviderProfile: {
          include: { user: { select: { name: true } } },
        },
        review: {
          select: { id: true, rating: true, text: true, createdAt: true },
        },
        payments: {
          where: { status: 'PAID' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!request) throw new NotFoundException('درخواست پیدا نشد');
    if (request.customerId !== currentUser.userId) {
      throw new ForbiddenException('به این درخواست دسترسی ندارید');
    }
    return this.toCustomerView(request);
  }

  @ApiOperation({
    summary: 'Update my service request before a provider accepts it',
  })
  @Patch(':id')
  async updateMine(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServiceRequestDto,
  ) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, customerId: currentUser.userId },
      select: {
        id: true,
        status: true,
        budgetMin: true,
        budgetMax: true,
        latitude: true,
        longitude: true,
        updatedAt: true,
      },
    });
    if (!request) throw new NotFoundException('درخواست پیدا نشد');
    if (request.status !== 'OPEN') {
      throw new ConflictException(
        'ویرایش درخواست پس از دریافت پیشنهاد متخصص امکان‌پذیر نیست',
      );
    }

    const hasChanges = Object.values(dto).some((value) => value !== undefined);
    if (!hasChanges) {
      throw new BadRequestException('حداقل یک فیلد برای ویرایش ارسال کنید');
    }

    const budgetMin =
      dto.budgetMin === undefined ? request.budgetMin : dto.budgetMin;
    const budgetMax =
      dto.budgetMax === undefined ? request.budgetMax : dto.budgetMax;
    if (
      (dto.budgetMin !== undefined || dto.budgetMax !== undefined) &&
      (budgetMin === null) !== (budgetMax === null)
    ) {
      throw new BadRequestException(
        'حداقل و حداکثر بودجه را با هم ثبت یا پاک کنید',
      );
    }
    if (
      (dto.budgetMin !== undefined || dto.budgetMax !== undefined) &&
      budgetMin !== null &&
      budgetMax !== null &&
      budgetMin > budgetMax
    ) {
      throw new BadRequestException(
        'حداقل بودجه نباید از حداکثر بودجه بیشتر باشد',
      );
    }

    const latitude =
      dto.latitude === undefined ? request.latitude : dto.latitude;
    const longitude =
      dto.longitude === undefined ? request.longitude : dto.longitude;
    if (
      (dto.latitude !== undefined || dto.longitude !== undefined) &&
      (latitude === null) !== (longitude === null)
    ) {
      throw new BadRequestException(
        'طول و عرض جغرافیایی باید هم‌زمان ثبت یا پاک شوند',
      );
    }

    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: request.id,
        customerId: currentUser.userId,
        status: 'OPEN',
        updatedAt: request.updatedAt,
      },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description.trim(),
        }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        }),
        ...(dto.budgetMin !== undefined && { budgetMin: dto.budgetMin }),
        ...(dto.budgetMax !== undefined && { budgetMax: dto.budgetMax }),
      },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'درخواست هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید',
      );
    }

    return { id: request.id, message: 'درخواست ویرایش شد' };
  }

  @ApiOperation({ summary: 'Review a completed service request' })
  @Post(':id/review')
  async reviewCompletedRequest(
    @CurrentUser() currentUser: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestReviewDto,
  ) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: {
        id,
        customerId: currentUser.userId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        acceptedProviderProfileId: true,
        review: { select: { id: true } },
      },
    });
    if (!request?.acceptedProviderProfileId) {
      throw new NotFoundException('درخواست تکمیل‌شده برای ثبت نظر پیدا نشد');
    }
    if (request.review) {
      throw new ConflictException('برای این درخواست قبلاً نظر ثبت شده است');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.serviceRequestReview.create({
          data: {
            serviceRequestId: request.id,
            customerId: currentUser.userId,
            providerProfileId: request.acceptedProviderProfileId!,
            rating: dto.rating,
            text: dto.text?.trim() || null,
          },
          select: { id: true, rating: true, text: true, createdAt: true },
        });
        const aggregate = await tx.serviceRequestReview.aggregate({
          where: { providerProfileId: request.acceptedProviderProfileId! },
          _avg: { rating: true },
        });
        await tx.providerProfile.update({
          where: { id: request.acceptedProviderProfileId! },
          data: { rating: aggregate._avg.rating ?? 0 },
        });
        return review;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('برای این درخواست قبلاً نظر ثبت شده است');
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Create a new service request' })
  @Post()
  async create(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateServiceRequestDto,
  ) {
    const request = await this.createServiceRequestUseCase.execute({
      customerId: currentUser.userId,
      title: dto.title,
      description: dto.description,
      skillName: dto.skillName,
      specialtyId: dto.specialtyId,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      preferredTime: dto.preferredTime,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      budgetMin: dto.budgetMin,
      budgetMax: dto.budgetMax,
    });
    void this.matchProviders
      .execute(request.id)
      .catch((error) =>
        this.logger.error(
          `Matching failed for request ${request.id}`,
          error instanceof Error ? error.stack : String(error),
        ),
      );
    return ServiceRequestResponseDto.fromEntity(request);
  }

  @ApiOperation({ summary: 'Add a required skill to your service request' })
  @Post(':id/skills')
  async addSkill(
    @Param('id') id: string,
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: AddSkillToRequestDto,
  ) {
    await this.addSkillToRequestUseCase.execute(
      id,
      currentUser.userId,
      dto.skillName,
    );
    return { message: 'Skill added to service request' };
  }

  @ApiOperation({ summary: 'Upload an image for a service request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @CurrentUser() currentUser: TokenPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadServiceRequestImageUseCase.execute(
      id,
      currentUser.userId,
      file.buffer,
    );
  }

  private toCustomerView(request: {
    id: string;
    title: string;
    description: string;
    status: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
    providerPriceToman: number | null;
    providerPricingMode: 'QUOTE' | 'HOURLY' | null;
    providerHourlyRateToman: number | null;
    providerHourlyUnitLabel: string | null;
    providerEstimatedHours: number | null;
    scheduledAt: Date | null;
    customerConfirmationDeadline: Date | null;
    createdAt: Date;
    skills: { skill: { name: string } }[];
    specialty: { name: string } | null;
    images: { id: string; url: string }[];
    acceptedProviderProfile: {
      id: string;
      rating: number;
      user: { name: string };
    } | null;
    review: {
      id: string;
      rating: number;
      text: string | null;
      createdAt: Date;
    } | null;
    payments: { id: string }[];
  }) {
    const provider = request.acceptedProviderProfile;
    const status =
      {
        OPEN: 'awaiting_offers',
        OFFER_ACCEPTED: 'offers_received',
        CUSTOMER_CONFIRMATION_PENDING: 'awaiting_payment',
        IN_PROGRESS: 'in_progress',
        AWAITING_CUSTOMER_CONFIRMATION: 'awaiting_confirmation',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        EXPIRED: 'cancelled',
        DISPUTED: 'disputed',
      }[request.status] ?? 'awaiting_offers';
    return {
      id: request.id,
      code: `R-${request.id.slice(0, 8).toUpperCase()}`,
      title: request.title,
      category:
        request.specialty?.name ??
        request.skills.map((item) => item.skill.name).join('، '),
      description: request.description,
      addressLabel: request.address ?? '',
      latitude: request.latitude,
      longitude: request.longitude,
      createdAt: request.createdAt.toISOString(),
      scheduledAt: request.scheduledAt?.toISOString(),
      customerConfirmationDeadline:
        request.customerConfirmationDeadline?.toISOString(),
      status,
      offersCount: provider ? 1 : 0,
      budget:
        request.budgetMin !== null && request.budgetMax !== null
          ? { min: request.budgetMin, max: request.budgetMax }
          : undefined,
      price:
        request.providerPriceToman ??
        request.budgetMax ??
        request.budgetMin ??
        undefined,
      priceDetails:
        request.providerPricingMode === 'HOURLY'
          ? {
              mode: 'HOURLY',
              hourlyRateToman: request.providerHourlyRateToman,
              hourlyUnitLabel: request.providerHourlyUnitLabel,
              estimatedHours: request.providerEstimatedHours,
            }
          : request.providerPricingMode === 'QUOTE'
            ? { mode: 'QUOTE' }
            : undefined,
      specialist: provider
        ? {
            id: provider.id,
            name: provider.user.name,
            field:
              request.specialty?.name ??
              request.skills.map((item) => item.skill.name).join('، '),
            rating: provider.rating,
          }
        : undefined,
      images: request.images.map((image) => image.url),
      reviewed: Boolean(request.review),
      review: request.review
        ? {
            id: request.review.id,
            rating: request.review.rating,
            text: request.review.text,
            createdAt: request.review.createdAt.toISOString(),
          }
        : null,
      wasPaid: request.payments.length > 0,
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
      6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }
}
