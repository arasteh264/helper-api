import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { PROVIDER_DOCUMENT_REPOSITORY } from '../../application/documents/provider-document.repository.token';
import type { ProviderDocumentRepository } from '../../application/documents/provider-document.repository';

import { ProviderPrivateProfileDetailsResponseDto } from '../../application/dto/provider-private-profile-details-response.dto';
import { AdminPendingProvidersQueryDto } from '../../application/dto/admin-pending-providers-query.dto';
import { GetProviderDocumentsForReviewUseCase } from '../../application/documents/get-provider-documents-for-review.use-case';
import { ReviewProviderDto } from '../../application/dto/review-provider-document.dto';
import { ReviewProviderDocumentUseCase } from '../../application/documents/review-provider-document.use-case';
import { areRequiredDocumentsApproved } from '../../infrastructure/provider-documents.util';
import { ReviewProviderDocumentDto } from '../../application/documents/review-provider-document.dto';
import { GetAdminProviderInsightsUseCase } from '../../application/get-admin-provider-insights.use-case';
import { UpdateAccountStatusDto } from '../../../admin/admin-operations.dto';
import { UpdateAdminProviderProfileDto } from '../../application/dto/update-admin-provider-profile.dto';
import { Prisma } from '../../../../../generated/prisma/client';

@ApiTags('Admin - Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/providers')
export class AdminProviderController {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    private readonly getProviderDocumentsForReviewUseCase: GetProviderDocumentsForReviewUseCase,
    private readonly reviewProviderDocumentUseCase: ReviewProviderDocumentUseCase,
    private readonly getAdminProviderInsightsUseCase: GetAdminProviderInsightsUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Get provider registration and performance insights',
  })
  @Get('analytics')
  getAnalytics() {
    return this.getAdminProviderInsightsUseCase.execute();
  }

  @ApiOperation({ summary: 'List provider profiles by verification status' })
  @Get('pending')
  async listPending(
    @CurrentUser() _currentUser: TokenPayload,
    @Query() query: AdminPendingProvidersQueryDto,
  ) {
    const { items, total } =
      await this.providerProfileRepository.findPendingDetailsPage({
        skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 10),
        take: query.pageSize ?? 10,
        search: query.search?.trim() || undefined,
        status: query.status,
        isAvailable:
          query.available === undefined
            ? undefined
            : query.available === 'true',
      });

    return {
      items: items.map((provider) =>
        ProviderPrivateProfileDetailsResponseDto.from(provider),
      ),
      total,
    };
  }

  @ApiOperation({ summary: 'Review a provider registration' })
  @Patch(':providerId/review')
  async review(
    @CurrentUser() admin: TokenPayload,
    @Param('providerId') providerId: string,
    @Body() dto: ReviewProviderDto,
  ) {
    const profile = await this.providerProfileRepository.findById(providerId);
    if (!profile) throw new NotFoundException('Provider profile not found');
    const beforeState = {
      verificationStatus: profile.verificationStatus,
      verificationNote: profile.verificationNote,
      verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    };

    if (dto.status === 'APPROVED') {
      const documents =
        await this.providerDocumentRepository.findByProviderProfileId(
          providerId,
        );

      if (!areRequiredDocumentsApproved(documents)) {
        throw new BadRequestException(
          'همه‌ی مدارک اجباری باید قبل از تأیید نهایی، تأیید شده باشن',
        );
      }
    }

    profile.reviewDecision(dto.status, dto.note);
    await this.providerProfileRepository.update(profile, {
      actorUserId: admin.userId,
      action:
        dto.status === 'APPROVED' ? 'PROVIDER_APPROVED' : 'PROVIDER_REJECTED',
      reason: dto.note?.trim() || 'تصمیم‌گیری درباره‌ی ثبت‌نام متخصص',
      beforeState,
      afterState: {
        verificationStatus: profile.verificationStatus,
        verificationNote: profile.verificationNote,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
      },
    });

    const details = await this.providerProfileRepository.findDetailsByUserId(
      profile.userId,
    );

    return ProviderPrivateProfileDetailsResponseDto.from(details!);
  }

  @ApiOperation({ summary: 'Get all verification documents of a provider' })
  @Get(':providerProfileId/documents')
  getDocuments(@Param('providerProfileId') providerProfileId: string) {
    return this.getProviderDocumentsForReviewUseCase.execute(providerProfileId);
  }

  @ApiOperation({ summary: 'Get full provider profile details for administration' })
  @Get(':providerProfileId/details')
  async getAdminDetails(@Param('providerProfileId') providerProfileId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      include: {
        user: { select: { name: true, email: true, phone: true, status: true } },
        skills: { include: { skill: true } },
        specialties: {
          include: { specialty: { include: { group: { select: { name: true } } } } },
        },
        documents: {
          select: { id: true, type: true, url: true, status: true, rejectionNote: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { acceptedServiceRequests: { where: { status: 'COMPLETED' } } },
        },
      },
    });
    if (!profile) throw new NotFoundException('سرویس‌دهنده پیدا نشد');

    const specialtyOptions = await this.prisma.specialty.findMany({
      where: { isActive: true, group: { isActive: true } },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return {
      id: profile.id,
      bio: profile.bio,
      rating: profile.rating,
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      verificationNote: profile.verificationNote,
      verifiedAt: profile.verifiedAt,
      isAvailable: profile.isAvailable,
      avatarUrl: profile.avatarUrl,
      serviceAreaLatitude: profile.serviceAreaLatitude,
      serviceAreaLongitude: profile.serviceAreaLongitude,
      serviceAreaRadiusKm: profile.serviceAreaRadiusKm,
      providerAddress: profile.providerAddress,
      providerAddressType: profile.providerAddressType,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      completedJobs: profile._count.acceptedServiceRequests,
      user: profile.user,
      skills: profile.skills.map(({ skill }) => ({ id: skill.id, name: skill.name })),
      specialties: profile.specialties.map(({ specialty }) => ({
        id: specialty.id,
        name: specialty.name,
        groupName: specialty.group.name,
      })),
      specialtyOptions: specialtyOptions.map(({ id, name, group }) => ({
        id,
        name,
        groupName: group.name,
      })),
      documents: profile.documents,
    };
  }

  @ApiOperation({ summary: 'Update a provider profile and record the change' })
  @Patch(':providerProfileId/details')
  async updateAdminDetails(
    @CurrentUser() admin: TokenPayload,
    @Param('providerProfileId') providerProfileId: string,
    @Body() dto: UpdateAdminProviderProfileDto,
  ) {
    const reason = dto.reason.trim();
    const skillNames = dto.skillNames?.map((name) => name.trim());
    if (skillNames?.some((name) => !name)) {
      throw new BadRequestException('نام مهارت نمی‌تواند خالی باشد');
    }
    if (skillNames && new Set(skillNames.map((name) => name.toLocaleLowerCase())).size !== skillNames.length) {
      throw new BadRequestException('مهارت تکراری در فهرست وجود دارد');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const profile = await tx.providerProfile.findUnique({
          where: { id: providerProfileId },
          include: {
            user: { select: { name: true, email: true, phone: true } },
            skills: { include: { skill: { select: { name: true } } } },
            specialties: { include: { specialty: { select: { id: true, name: true } } } },
          },
        });
        if (!profile) throw new NotFoundException('سرویس‌دهنده پیدا نشد');
        if (profile.userId === admin.userId) {
          throw new BadRequestException('مدیر نمی‌تواند پروفایل خودش را از این مسیر ویرایش کند');
        }

        const beforeState = {
          name: profile.user.name,
          email: profile.user.email,
          phone: profile.user.phone,
          bio: profile.bio,
          providerAddress: profile.providerAddress,
          providerAddressType: profile.providerAddressType,
          serviceAreaRadiusKm: profile.serviceAreaRadiusKm,
          specialties: profile.specialties.map(({ specialty }) => specialty.name),
          skills: profile.skills.map(({ skill }) => skill.name),
        };

        const userData = {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
        };
        if (Object.keys(userData).length) {
          await tx.user.update({ where: { id: profile.userId }, data: userData });
        }

        const profileData = {
          ...(dto.bio !== undefined ? { bio: dto.bio?.trim() || null } : {}),
          ...(dto.providerAddress !== undefined
            ? { providerAddress: dto.providerAddress?.trim() || null }
            : {}),
          ...(dto.providerAddressType !== undefined ? { providerAddressType: dto.providerAddressType } : {}),
          ...(dto.serviceAreaRadiusKm !== undefined ? { serviceAreaRadiusKm: dto.serviceAreaRadiusKm } : {}),
        };
        if (Object.keys(profileData).length) {
          await tx.providerProfile.update({ where: { id: providerProfileId }, data: profileData });
        }

        if (dto.specialtyIds !== undefined) {
          const activeSpecialties = await tx.specialty.findMany({
            where: { id: { in: dto.specialtyIds }, isActive: true, group: { isActive: true } },
            select: { id: true },
          });
          if (activeSpecialties.length !== dto.specialtyIds.length) {
            throw new BadRequestException('یک یا چند تخصص انتخاب‌شده معتبر یا فعال نیست');
          }
          await tx.providerSpecialty.deleteMany({ where: { providerProfileId } });
          if (dto.specialtyIds.length) {
            await tx.providerSpecialty.createMany({
              data: dto.specialtyIds.map((specialtyId) => ({ providerProfileId, specialtyId })),
            });
          }
        }

        if (skillNames !== undefined) {
          await tx.providerSkill.deleteMany({ where: { providerProfileId } });
          for (const name of skillNames) {
            const skill = await tx.skill.upsert({
              where: { name },
              create: { name },
              update: {},
              select: { id: true },
            });
            await tx.providerSkill.create({ data: { providerProfileId, skillId: skill.id } });
          }
        }

        const updated = await tx.providerProfile.findUniqueOrThrow({
          where: { id: providerProfileId },
          include: {
            user: { select: { name: true, email: true, phone: true } },
            skills: { include: { skill: { select: { name: true } } } },
            specialties: { include: { specialty: { select: { name: true } } } },
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorUserId: admin.userId,
            action: 'PROVIDER_PROFILE_UPDATED',
            targetType: 'PROVIDER',
            targetId: providerProfileId,
            reason,
            beforeState,
            afterState: {
              name: updated.user.name,
              email: updated.user.email,
              phone: updated.user.phone,
              bio: updated.bio,
              providerAddress: updated.providerAddress,
              providerAddressType: updated.providerAddressType,
              serviceAreaRadiusKm: updated.serviceAreaRadiusKm,
              specialties: updated.specialties.map(({ specialty }) => specialty.name),
              skills: updated.skills.map(({ skill }) => skill.name),
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('ایمیل یا شماره تماس واردشده قبلاً ثبت شده است');
      }
      throw error;
    }

    return { updated: true };
  }

  @ApiOperation({ summary: 'Approve or reject a verification document' })
  @Patch('documents/:documentId/review')
  reviewDocument(
    @CurrentUser() admin: TokenPayload,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewProviderDocumentDto,
  ) {
    return this.reviewProviderDocumentUseCase.execute(
      documentId,
      dto.decision,
      dto.rejectionNote,
      admin.userId,
    );
  }

  @ApiOperation({
    summary: 'Suspend or reactivate an approved provider with an audit reason',
  })
  @Patch(':providerProfileId/status')
  async updateProviderStatus(
    @CurrentUser() admin: TokenPayload,
    @Param('providerProfileId') providerProfileId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: {
        id: true,
        userId: true,
        verificationStatus: true,
        isAvailable: true,
        user: { select: { status: true } },
      },
    });
    if (!profile) throw new NotFoundException('سرویس‌دهنده پیدا نشد');
    if (profile.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'کنترل وضعیت فقط برای سرویس‌دهنده‌ی تأییدشده در دسترس است',
      );
    }
    if (profile.userId === admin.userId) {
      throw new BadRequestException(
        'مدیر نمی‌تواند حساب خودش را از این مسیر تغییر وضعیت دهد',
      );
    }
    if (profile.user.status === dto.status) {
      return { id: profile.id, status: profile.user.status, changed: false };
    }

    await this.prisma.$transaction(async (tx) => {
      const update = await tx.user.updateMany({
        where: { id: profile.userId, status: profile.user.status },
        data: { status: dto.status },
      });
      if (!update.count) {
        throw new BadRequestException(
          'وضعیت حساب هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید',
        );
      }

      if (dto.status === 'SUSPENDED') {
        await tx.providerProfile.update({
          where: { id: profile.id },
          data: { isAvailable: false },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.userId,
          action:
            dto.status === 'SUSPENDED'
              ? 'PROVIDER_SUSPENDED'
              : 'PROVIDER_REACTIVATED',
          targetType: 'PROVIDER',
          targetId: profile.id,
          reason: dto.reason.trim(),
          beforeState: {
            status: profile.user.status,
            isAvailable: profile.isAvailable,
          },
          afterState: {
            status: dto.status,
            isAvailable:
              dto.status === 'SUSPENDED' ? false : profile.isAvailable,
          },
        },
      });
    });
    return { id: profile.id, status: dto.status, changed: true };
  }
}
