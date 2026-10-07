import {
  Body,
  Controller,
  Delete,
  Get,
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

@ApiTags('Admin - Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/service-requests')
export class AdminServiceRequestController {
  constructor(
    private readonly listUseCase: AdminListServiceRequestsUseCase,
    private readonly paymentsService: PaymentsService,
    private readonly actionsUseCases: AdminServiceRequestActionsUseCases,
  ) {}

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
