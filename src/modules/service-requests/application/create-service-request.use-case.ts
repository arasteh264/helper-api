import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ServiceRequestRepository } from '../domain/repositories/service-request.repository';
import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';
import { ServiceRequest } from '../domain/entities/service-request.entity';
import type { SkillRepository } from '../../providers/domain/repositories/skill.repository';
import { SKILL_REPOSITORY } from '../../providers/domain/repositories/skill.repository.token';
import { PreferredTime } from '../domain/entities/preferred-time.enum';

interface CreateServiceRequestInput {
  customerId: string;
  title: string;
  description: string;
  skillName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  preferredTime?: PreferredTime;
  scheduledAt?: Date;
  budgetMin?: number;
  budgetMax?: number;
}

@Injectable()
export class CreateServiceRequestUseCase {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly serviceRequestRepository: ServiceRequestRepository,
    @Inject(SKILL_REPOSITORY)
    private readonly skillRepository: SkillRepository,
  ) {}

  async execute(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    const request = ServiceRequest.create(
      input.customerId,
      input.title,
      input.description,
    );

    if (
      input.budgetMin !== undefined &&
      input.budgetMax !== undefined &&
      input.budgetMin > input.budgetMax
    ) {
      throw new BadRequestException('حداقل بودجه نباید از حداکثر بیشتر باشد');
    }

    request.setLocation(
      input.address,
      input.latitude ?? null,
      input.longitude ?? null,
    );
    if (input.budgetMin !== undefined && input.budgetMax !== undefined) {
      request.setBudget(input.budgetMin, input.budgetMax);
    }
    if (input.preferredTime) request.setPreferredTime(input.preferredTime);
    request.setScheduledAt(input.scheduledAt ?? null);
    const skill = await this.skillRepository.findOrCreateByName(
      input.skillName,
    );
    request.addSkill(skill.id);

    await this.serviceRequestRepository.save(request);

    return request;
  }
}
