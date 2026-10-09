import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  ConflictException,
  NotFoundException,
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
  ) {}

  @ApiOperation({ summary: 'Get service request review settings' })
  @Get('review-settings')
  async getReviewSettings() {
    const settings = await this.prisma.walletConfiguration.upsert({
      where: { id: 'global' },
      create: { id: 'global' },
      update: {},
      select: { requireServiceRequestReview: true },
    });
    return settings;
  }

  @ApiOperation({ summary: 'Set whether service requests require admin review' })
  @Patch('review-settings')
  async updateReviewSettings(
    @CurrentUser() admin: TokenPayload,
    @Body() dto: UpdateServiceRequestReviewSettingsDto,
  ) {
    const settings = await this.prisma.walletConfiguration.upsert({
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
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId: admin.userId,
        action: 'SERVICE_REQUEST_REVIEW_SETTING_UPDATED',
        targetType: 'PLATFORM_SETTING',
        targetId: 'service-request-review',
        reason: `requireServiceRequestReview=${dto.requireServiceRequestReview}`,
        afterState: settings,
      },
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
    if (dto.decision === 'REJECT' && !dto.note?.trim()) {
      throw new BadRequestException('برای رد درخواست، دلیل را وارد کنید');
    }
    const targetStatus = dto.decision === 'APPROVE' ? 'OPEN' : 'CANCELLED';
    const result = await this.prisma.$transaction(async (transaction) => {
      const request = await transaction.serviceRequest.findUnique({
        where: { id },
        select: { id: true, status: true, adminReviewNote: true },
      });
      if (!request) throw new NotFoundException('درخواست سرویس پیدا نشد');
      if (request.status !== 'PENDING_ADMIN_REVIEW') {
        throw new ConflictException('این درخواست در انتظار بررسی مدیر نیست');
      }
      const updated = await transaction.serviceRequest.updateMany({
        where: { id, status: 'PENDING_ADMIN_REVIEW' },
        data: {
          status: targetStatus,
          adminReviewNote: dto.note?.trim() || null,
        },
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
          reason: dto.note?.trim() || 'تأیید درخواست',
          beforeState: { status: request.status },
          afterState: { status: targetStatus, note: dto.note?.trim() || null },
        },
      });
      return { id, status: targetStatus, note: dto.note?.trim() || null };
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

  @ApiOperation({ summary: 'Get full service request details for admin review' })
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
