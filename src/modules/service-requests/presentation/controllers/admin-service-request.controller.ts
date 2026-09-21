import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
// import { AdminGuard } from '...';  ← گارد نقش ادمین خودت
import { AdminListServiceRequestsUseCase } from '../../application/admin-list-service-requests.use-case';
import { AdminListServiceRequestsQueryDto } from '../../application/dto/admin-list-service-requests-query.dto';

@ApiTags('Admin - Service Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard /*, AdminGuard */)
@Controller('admin/service-requests')
export class AdminServiceRequestController {
  constructor(
    private readonly listUseCase: AdminListServiceRequestsUseCase,
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
}