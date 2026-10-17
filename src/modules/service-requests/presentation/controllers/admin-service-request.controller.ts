import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { AdminListServiceRequestsUseCase } from '../../application/admin-list-service-requests.use-case';
import { AdminListServiceRequestsQueryDto } from '../../application/dto/admin-list-service-requests-query.dto';
import { ResolveServiceRequestDisputeDto } from '../../application/dto/resolve-service-request-dispute.dto';
import { PaymentsService } from '../../../payments/payments.service';
import { CreateServiceRequestDisputeMessageDto } from '../../../payments/dto/create-service-request-dispute-message.dto';
import { AdminServiceRequestActionsUseCases } from '../../application/admin-service-request-actions.use-cases';
import {
  ReviewServiceRequestDto,
  UpdateServiceRequestReviewSettingsDto,
} from '../../application/dto/review-service-request.dto';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { MatchProvidersForRequestUseCase } from '../../../matching/application/match-providers-for-request.use-case';
import { ReviewProviderCancellationDto } from '../../application/dto/review-provider-cancellation.dto';
import { NotificationsService } from '../../../notifications/notifications.service';

@ApiTags('Admin - Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/service-requests')
export class AdminServiceRequestController {
  private readonly logger = new Logger(AdminServiceRequestController.name);

  constructor(
    private readonly listUseCase: AdminListServiceRequestsUseCase,
    private readonly paymentsService: PaymentsService,
    private readonly actionsUseCases: AdminServiceRequestActionsUseCases,
    private readonly prisma: PrismaService,
    private readonly matchProviders: MatchProvidersForRequestUseCase,
    private readonly notifications: NotificationsService,
  ) {}

  @ApiOperation({ summary: 'Get service request review settings' })
  @Get('review-settings')
  async getReviewSettings() {
    return this.prisma.walletConfiguration.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
      select: { requireServiceRequestReview: true },
    });
  }

  @ApiOperation({
    summary: 'Set whether service requests require admin review',
  })
  @Patch('review-settings')
  async updateReviewSettings(
    @CurrentUser() admin: TokenPayload,
    @Body() dto: UpdateServiceRequestReviewSettingsDto,
  ) {
    const settings = await this.prisma.$transaction(async (transaction) => {
      const updatedSettings = await transaction.walletConfiguration.upsert({
        where: { id: 'global' },
        create: {
          id: 'global',
          requireServiceRequestReview: dto.requireServiceRequestReview,
        },
        update: {
          requireServiceRequestReview: dto.requireServiceRequestReview,
        },
        select: { requireServiceRequestReview: true },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: admin.userId,
          action: 'SERVICE_REQUEST_REVIEW_SETTING_UPDATED',
          targetType: 'PLATFORM_SETTING',
          targetId: 'service-request-review',
          reason: `requireServiceRequestReview=${dto.requireServiceRequestReview}`,
          afterState: updatedSettings,
        },
      });
      return updatedSettings;
    });
    return settings;
  }

  @ApiOperation({ summary: 'Approve or reject a service request' })
  @Post(':id/review')
  async reviewRequest(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ReviewServiceRequestDto,
  ) {
    const note = dto.note?.trim() || null;
    if (dto.decision === 'REJECT' && !note) {
      throw new BadRequestException('برای رد درخواست، دلیل را وارد کنید');
    }
    const targetStatus = dto.decision === 'APPROVE' ? 'OPEN' : 'CANCELLED';
    const result = await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!request) throw new NotFoundException('درخواست سرویس پیدا نشد');
      if (request.status !== 'PENDING_ADMIN_REVIEW') {
        throw new ConflictException('این درخواست در انتظار بررسی مدیر نیست');
      }
      const updated = await transaction.serviceRequest.updateMany({
        where: { id, status: 'PENDING_ADMIN_REVIEW' },
        data: { status: targetStatus, adminReviewNote: note },
      });
      if (updated.count !== 1) {
        throw new ConflictException('درخواست هم‌زمان تغییر کرده است');
      }
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: admin.userId,
          action:
            dto.decision === 'APPROVE'
              ? 'SERVICE_REQUEST_APPROVED'
              : 'SERVICE_REQUEST_REJECTED',
          targetType: 'SERVICE_REQUEST',
          targetId: id,
          reason: note ?? 'تأیید درخواست',
          beforeState: { status: request.status },
          afterState: { status: targetStatus, note },
        },
      });
      return { id, status: targetStatus, note };
    });

    if (dto.decision === 'APPROVE') {
      void this.matchProviders.execute(id).catch((error: unknown) => {
        this.logger.error(
          `Matching failed after admin approval for ${id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    }
    return result;
  }

  @ApiOperation({
    summary: 'List provider cancellation requests pending review',
  })
  @Get('cancellation-requests')
  async listProviderCancellationRequests() {
    const requests =
      await this.prisma.serviceRequestProviderCancellation.findMany({
        where: { status: 'PENDING' },
        include: {
          serviceRequest: {
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              address: true,
              payments: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { status: true, amountToman: true },
              },
              customer: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
          },
          providerProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
      });

    return requests.map((request) => ({
      id: request.id,
      reason: request.reason,
      note: request.note,
      requestedAt: request.requestedAt,
      serviceRequest: request.serviceRequest,
      provider: {
        id: request.providerProfile.id,
        user: request.providerProfile.user,
      },
    }));
  }

  @ApiOperation({
    summary: 'Approve or reject a provider cancellation request',
  })
  @Patch(':id/cancellation-review')
  async reviewProviderCancellation(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ReviewProviderCancellationDto,
  ) {
    const note = dto.note?.trim() || null;
    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT "id" FROM "ServiceRequestProviderCancellation" WHERE "id" = ${id} FOR UPDATE
      `;
      const cancellation =
        await transaction.serviceRequestProviderCancellation.findUnique({
          where: { id },
          include: {
            serviceRequest: {
              select: {
                id: true,
                title: true,
                status: true,
                customerId: true,
                acceptedProviderProfileId: true,
              },
            },
            providerProfile: { select: { id: true, userId: true } },
          },
        });
      if (!cancellation) {
        throw new NotFoundException('درخواست لغو پیدا نشد');
      }
      if (
        cancellation.status !== 'PENDING' ||
        !['OFFER_ACCEPTED', 'IN_PROGRESS'].includes(
          cancellation.serviceRequest.status,
        )
      ) {
        throw new ConflictException(
          'این درخواست لغو دیگر در انتظار بررسی نیست',
        );
      }

      const targetStatus = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      if (dto.decision === 'APPROVE') {
        const updatedRequest = await transaction.serviceRequest.updateMany({
          where: {
            id: cancellation.serviceRequestId,
            acceptedProviderProfileId: cancellation.providerProfileId,
            status: { in: ['OFFER_ACCEPTED', 'IN_PROGRESS'] },
          },
          data: { status: 'CANCELLED' },
        });
        if (updatedRequest.count !== 1) {
          throw new ConflictException('وضعیت درخواست هم‌زمان تغییر کرده است');
        }
      }
      const updatedCancellation =
        await transaction.serviceRequestProviderCancellation.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: targetStatus,
            resolvedAt: new Date(),
            resolvedByUserId: admin.userId,
            decisionNote: note,
          },
        });
      if (updatedCancellation.count !== 1) {
        throw new ConflictException('درخواست لغو هم‌زمان بررسی شده است');
      }
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: admin.userId,
          action:
            dto.decision === 'APPROVE'
              ? 'PROVIDER_CANCELLATION_APPROVED'
              : 'PROVIDER_CANCELLATION_REJECTED',
          targetType: 'SERVICE_REQUEST_PROVIDER_CANCELLATION',
          targetId: id,
          reason: note ?? cancellation.reason,
          beforeState: {
            requestStatus: cancellation.serviceRequest.status,
            cancellationStatus: cancellation.status,
          },
          afterState: {
            requestStatus:
              dto.decision === 'APPROVE'
                ? 'CANCELLED'
                : cancellation.serviceRequest.status,
            cancellationStatus: targetStatus,
            note,
          },
        },
      });
      return {
        id,
        status: targetStatus,
        serviceRequestId: cancellation.serviceRequest.id,
        serviceRequestTitle: cancellation.serviceRequest.title,
        customerId: cancellation.serviceRequest.customerId,
        providerUserId: cancellation.providerProfile.userId,
      };
    });

    const approved = dto.decision === 'APPROVE';
    const message = approved
      ? `درخواست لغو کار «${result.serviceRequestTitle}» توسط مدیر تأیید شد.`
      : `درخواست لغو کار «${result.serviceRequestTitle}» توسط مدیر رد شد.${note ? ` دلیل: ${note}` : ''}`;
    await Promise.all([
      this.notifications.createForUser({
        userId: result.customerId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: approved ? 'لغو درخواست تأیید شد' : 'درخواست لغو رد شد',
        body: message,
        serviceRequestId: result.serviceRequestId,
      }),
      this.notifications.createForUser({
        userId: result.providerUserId,
        category: 'WORK_UPDATES',
        type: 'SERVICE_REQUEST_STATUS',
        title: approved ? 'درخواست لغو کار تأیید شد' : 'درخواست لغو کار رد شد',
        body: message,
        serviceRequestId: result.serviceRequestId,
      }),
    ]);
    return { id: result.id, status: result.status };
  }

  @ApiOperation({ summary: 'List all service requests (admin)' })
  @Get()
  async list(@Query() query: AdminListServiceRequestsQueryDto) {
    return this.listUseCase.execute({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      search: query.search,
      status: query.status,
      customerId: query.customerId,
      preferredTime: query.preferredTime,
      skillIds: query.skillIds,
      budgetFrom: query.budgetFrom,
      budgetTo: query.budgetTo,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      updatedFrom: query.updatedFrom,
      updatedTo: query.updatedTo,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    });
  }

  @ApiOperation({
    summary: 'Get full service request details for admin review',
  })
  @Get(':id/details')
  getDetails(@Param('id') id: string) {
    return this.actionsUseCases.getDetails(id);
  }

  @ApiOperation({ summary: 'Cancel an incomplete unpaid open service request' })
  @Delete(':id')
  cancelIncomplete(@Param('id') id: string) {
    return this.actionsUseCases.cancelIncomplete(id);
  }

  @ApiOperation({ summary: 'Resolve a disputed paid service request' })
  @Get(':id/dispute')
  getDispute(@Param('id') id: string) {
    return this.paymentsService.getDisputeForAdmin(id);
  }

  @ApiOperation({ summary: 'Send a message to both participants in a dispute' })
  @Post(':id/dispute/messages')
  addDisputeMessage(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestDisputeMessageDto,
  ) {
    return this.paymentsService.addAdminDisputeMessage(
      id,
      admin.userId,
      dto.body,
    );
  }

  @ApiOperation({ summary: 'Resolve a disputed paid service request' })
  @Patch(':id/dispute')
  resolveDispute(
    @CurrentUser() admin: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ResolveServiceRequestDisputeDto,
  ) {
    return this.paymentsService.resolveDisputedRequestByAdmin(
      id,
      dto.resolution,
      admin.userId,
      dto.reason,
    );
  }
}
