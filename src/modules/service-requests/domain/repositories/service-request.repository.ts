import { ServiceRequest } from '../entities/service-request.entity';

export interface ServiceRequestRepository {
  save(request: ServiceRequest): Promise<void>;
  update(request: ServiceRequest): Promise<void>;
  findById(id: string): Promise<ServiceRequest | null>;
  findByCustomerId(customerId: string): Promise<ServiceRequest[]>;
  findOpenBySkillIds(skillIds: string[]): Promise<ServiceRequest[]>;
}