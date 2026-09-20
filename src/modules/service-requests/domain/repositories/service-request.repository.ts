import { ServiceRequest } from '../entities/service-request.entity';

export interface ServiceRequestRepository {
  save(request: ServiceRequest): Promise<void>;
  update(request: ServiceRequest): Promise<void>;
  addImage(serviceRequestId: string, url: string, publicId: string): Promise<{ id: string; url: string }>;
  findById(id: string): Promise<ServiceRequest | null>;
  findByCustomerId(customerId: string): Promise<ServiceRequest[]>;
  findOpenBySkillIds(skillIds: string[]): Promise<ServiceRequest[]>;
}