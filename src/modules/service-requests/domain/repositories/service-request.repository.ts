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

export interface AdminServiceRequestListItem {
  request: ServiceRequest;
  customer: { name: string; email: string; phone: string } | null;
  skills: { id: string; name: string }[];
}

export interface AdminServiceRequestDetails {
  id: string;
  title: string;
  description: string;
  status: ServiceRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  preferredTime: PreferredTime | null;
  scheduledAt: Date | null;
  budgetMin: number | null;
  budgetMax: number | null;
  providerPriceToman: number | null;
  providerPricingMode: string | null;
  providerHourlyRateToman: number | null;
  providerHourlyUnitLabel: string | null;
  providerEstimatedHours: number | null;
  specialty: string | null;
  skills: string[];
  images: { url: string; createdAt: Date }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    createdAt: Date;
    serviceRequestCount: number;
  } | null;
  provider: { name: string; email: string; phone: string; rating: number } | null;
  payments: {
    amountToman: number;
    gateway: string;
    status: string;
    referenceId: string | null;
    paidAt: Date | null;
    createdAt: Date;
  }[];
  review: { rating: number; text: string | null; createdAt: Date } | null;
  dispute: {
    reason: string | null;
    description: string | null;
    resolution: string | null;
    resolutionNote: string | null;
    resolvedAt: Date | null;
  } | null;
  invitationCounts: { pending: number; accepted: number; declined: number };
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
  findAllAdmin(
    filter: FindAllServiceRequestsFilter,
  ): Promise<PaginatedResult<AdminServiceRequestListItem>>;
  findAdminDetails(id: string): Promise<AdminServiceRequestDetails | null>;
  cancelOpenRequestWithoutPayments(id: string): Promise<boolean>;
}
