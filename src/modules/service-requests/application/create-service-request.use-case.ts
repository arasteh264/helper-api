import { Inject, Injectable } from '@nestjs/common';
import type { ServiceRequestRepository } from '../domain/repositories/service-request.repository';
import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';
import { ServiceRequest } from '../domain/entities/service-request.entity';

interface CreateServiceRequestInput {
  customerId: string;
  title: string;
  description: string;
}

@Injectable()
export class CreateServiceRequestUseCase {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly serviceRequestRepository: ServiceRequestRepository,
  ) {}

  async execute(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const request = ServiceRequest.create(
      input.customerId,
      input.title,
      input.description,
    );

    await this.serviceRequestRepository.save(request);

    return request;
  }
}
