import { Inject, Injectable } from '@nestjs/common';
import type {
  ServiceRequestRepository,
  FindAllServiceRequestsFilter,
} from '../domain/repositories/service-request.repository';
import { ServiceRequestResponseDto } from './dto/service-request-response.dto';
import { buildPaginatedResult } from '@/shared/utils/paginate.util';
import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';

@Injectable()
export class AdminListServiceRequestsUseCase {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly repository: ServiceRequestRepository,
  ) {}

  async execute(filter: FindAllServiceRequestsFilter) {
    const { items, total } = await this.repository.findAll(filter);

    return buildPaginatedResult(
      items.map((r) => ServiceRequestResponseDto.fromEntity(r)),
      total,
    );
  }
}
