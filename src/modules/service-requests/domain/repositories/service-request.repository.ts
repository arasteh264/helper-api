import { ServiceRequest } from '../entities/service-request.entity';
import { ServiceRequestStatus } from '../entities/service-request-status.enum';
import { PreferredTime } from '../entities/preferred-time.enum';
import { PaginatedResult } from '../../../../shared/types/paginated-result.type';

export interface FindAllServiceRequestsFilter {
  page: number;
  pageSize: number;
  search?: string;
  status?: ServiceRequestStatus;
  customerId?: string;
  preferredTime?: PreferredTime;
  skillIds?: string[];
  budgetFrom?: number;
  budgetTo?: number;
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
  sortBy: 'createdAt' | 'updatedAt' | 'budgetMin' | 'budgetMax';
  sortOrder: 'asc' | 'desc';
}

export interface ServiceRequestRepository {
  save(request: ServiceRequest): Promise<void>;
  update(request: ServiceRequest): Promise<void>;
  addImage(
    serviceRequestId: string,
    url: string,
    publicId: string,
  ): Promise<{ id: string; url: string }>;
  findById(id: string): Promise<ServiceRequest | null>;
  findByCustomerId(customerId: string): Promise<ServiceRequest[]>;
  findOpenBySkillIds(skillIds: string[]): Promise<ServiceRequest[]>;
  findAll(
    filter: FindAllServiceRequestsFilter,
  ): Promise<PaginatedResult<ServiceRequest>>;
}