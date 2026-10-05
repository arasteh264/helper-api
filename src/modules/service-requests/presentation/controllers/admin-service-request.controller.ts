import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

@ApiTags('Admin - Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/service-requests')
export class AdminServiceRequestController {
  constructor(
    private readonly listUseCase: AdminListServiceRequestsUseCase,
    private readonly paymentsService: PaymentsService,
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
