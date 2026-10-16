import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';

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
import { CreateProviderInvitationDto } from '../../application/dto/create-provider-invitation.dto';
import { ProviderOnboardingService } from '../../application/provider-onboarding.service';
import { SmsService } from '../../../sms/sms.service';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CreateProviderInvitationBatchDto } from '../../application/dto/create-provider-invitation-batch.dto';
import { RemindProviderInvitationBatchDto } from '../../application/dto/remind-provider-invitation-batch.dto';

@ApiTags('Admin - Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/providers')
export class AdminProviderController {
  private readonly logger = new Logger(AdminProviderController.name);

  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    private readonly getProviderDocumentsForReviewUseCase: GetProviderDocumentsForReviewUseCase,
    private readonly reviewProviderDocumentUseCase: ReviewProviderDocumentUseCase,
    private readonly getAdminProviderInsightsUseCase: GetAdminProviderInsightsUseCase,
    private readonly providerOnboardingService: ProviderOnboardingService,
    private readonly smsService: SmsService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Invite a provider to complete registration by SMS',
  })
  @Post('invitations')
  createInvitation(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateProviderInvitationDto,
  ) {
    return this.providerOnboardingService.createInvitation(
      dto.phone,
      currentUser.userId,
      { name: dto.name, specialty: dto.specialty },
    );
  }

  @ApiOperation({ summary: 'Send provider invitations from an imported list' })
  @Post('invitations/batch')
  createInvitationBatch(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: CreateProviderInvitationBatchDto,
  ) {
    return this.providerOnboardingService.createInvitationBatch(
      dto.items,
      currentUser.userId,
    );
  }

  @ApiOperation({ summary: 'List invited and registered providers' })
  @Get('invitations')
  async listInvitations() {
    const invitations = await this.prisma.providerOnboardingInvitation.findMany(
      {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5000,
        select: {
          id: true,
          phone: true,
          candidateName: true,
          specialty: true,
          createdAt: true,
          smsSentAt: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
        },
      },
    );

    const latestByPhone = new Map<string, (typeof invitations)[number]>();
    for (const invitation of invitations) {
      if (!latestByPhone.has(invitation.phone)) {
        latestByPhone.set(invitation.phone, invitation);
      }
    }

    const latestInvitations = [...latestByPhone.values()];
    const users = latestInvitations.length
      ? await this.prisma.user.findMany({
          where: { phone: { in: latestInvitations.map(({ phone }) => phone) } },
          select: {
            phone: true,
            name: true,
            role: true,
            createdAt: true,
            providerProfile: {
              select: { verificationStatus: true },
            },
          },
        })
      : [];
    const usersByPhone = new Map(users.map((user) => [user.phone, user]));

    return {
      items: latestInvitations.map((invitation) => {
        const user = usersByPhone.get(invitation.phone);
        const registered =
          invitation.usedAt !== null || user?.role === 'PROVIDER';
        return {
          id: invitation.id,
          phone: invitation.phone,
          name: invitation.candidateName ?? user?.name ?? null,
          specialty: invitation.specialty,
          invitedAt: invitation.createdAt,
          smsSentAt: invitation.smsSentAt,
          expiresAt: invitation.expiresAt,
          registeredAt:
            invitation.usedAt ??
            (user?.role === 'PROVIDER' ? user.createdAt : null),
          verificationStatus: user?.providerProfile?.verificationStatus ?? null,
          status: registered ? 'REGISTERED' : 'INVITED',
          canRemind: !registered,
        };
      }),
      total: latestInvitations.length,
    };
  }

  @ApiOperation({ summary: 'Remind a provider who has not registered yet' })
  @Post('invitations/:invitationId/remind')
  remindInvitation(
    @CurrentUser() currentUser: TokenPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.providerOnboardingService.remindInvitation(
      invitationId,
      currentUser.userId,
    );
  }

  @ApiOperation({
    summary: 'Remind multiple providers who have not registered',
  })
  @Post('invitations/remind-batch')
  remindInvitations(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: RemindProviderInvitationBatchDto,
  ) {
    return this.providerOnboardingService.remindInvitations(
      dto.invitationIds,
      currentUser.userId,
    );
  }

  @ApiOperation({
    summary: 'Get provider registration and performance insights',
  })
  @Get('analytics')
  getAnalytics() {
    return this.getAdminProviderInsightsUseCase.execute();
  }

  @ApiOperation({
    summary: 'Get declined service request history for a provider',
  })
  @Get(':providerId/declines')
  getDeclines(@Param('providerId') providerId: string) {
    return this.prisma.providerRequestInvitation.findMany({
      where: { providerProfileId: providerId, status: 'DECLINED' },
      select: {
        id: true,
        declineReason: true,
        declineNote: true,
        respondedAt: true,
        serviceRequest: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            specialty: { select: { name: true } },
          },
        },
      },
      orderBy: { respondedAt: 'desc' },
      take: 100,
    });
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
    @CurrentUser() _currentUser: TokenPayload,
    @Param('providerId') providerId: string,
    @Body() dto: ReviewProviderDto,
  ) {
    const profile = await this.providerProfileRepository.findById(providerId);
    if (!profile) throw new NotFoundException('Provider profile not found');

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

    const shouldSendApprovalSms =
      dto.status === 'APPROVED' && profile.verificationStatus !== 'APPROVED';
    profile.reviewDecision(dto.status, dto.note);
    await this.providerProfileRepository.update(profile);

    const details = await this.providerProfileRepository.findDetailsByUserId(
      profile.userId,
    );

    const response = ProviderPrivateProfileDetailsResponseDto.from(details!);
    if (shouldSendApprovalSms && details) {
      try {
        const customerAppUrl = (
          process.env.CUSTOMER_APP_URL ?? 'https://helper-customer.vercel.app'
        ).replace(/\/+$/, '');
        await this.smsService.sendNotification(
          details.user.phone,
          `ثبت‌نام شما در هلپر تأیید شد. برای دریافت اولین کار وارد پنل متخصص شوید: ${customerAppUrl}/provider`,
        );
        return { ...response, approvalSmsSent: true };
      } catch (error) {
        this.logger.error(
          `Provider ${providerId} was approved, but the SMS notification failed`,
          error instanceof Error ? error.stack : String(error),
        );
        return { ...response, approvalSmsSent: false };
      }
    }

    return response;
  }

  @ApiOperation({ summary: 'Get provider details for admin review' })
  @Get(':providerId/details')
  async getDetails(@Param('providerId') providerId: string) {
    const profile = await this.providerProfileRepository.findById(providerId);
    if (!profile) {
      throw new NotFoundException('Provider profile not found');
    }

    const details = await this.providerProfileRepository.findDetailsByUserId(
      profile.userId,
    );
    if (!details) {
      throw new NotFoundException('Provider details not found');
    }

    return ProviderPrivateProfileDetailsResponseDto.from(details);
  }

  @ApiOperation({ summary: 'Get all verification documents of a provider' })
  @Get(':providerProfileId/documents')
  getDocuments(@Param('providerProfileId') providerProfileId: string) {
    return this.getProviderDocumentsForReviewUseCase.execute(providerProfileId);
  }

  @ApiOperation({ summary: 'Approve or reject a verification document' })
  @Patch('documents/:documentId/review')
  reviewDocument(
    @Param('documentId') documentId: string,
    @Body() dto: ReviewProviderDocumentDto,
  ) {
    return this.reviewProviderDocumentUseCase.execute(
      documentId,
      dto.decision,
      dto.rejectionNote,
    );
  }
}
