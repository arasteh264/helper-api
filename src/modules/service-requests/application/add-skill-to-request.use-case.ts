import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { ServiceRequestRepository } from '../domain/repositories/service-request.repository';
import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';
import type { SkillRepository } from '../../providers/domain/repositories/skill.repository';
import { SKILL_REPOSITORY } from '../../providers/domain/repositories/skill.repository.token';

@Injectable()
export class AddSkillToRequestUseCase {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly serviceRequestRepository: ServiceRequestRepository,
    @Inject(SKILL_REPOSITORY)
    private readonly skillRepository: SkillRepository,
  ) {}

  async execute(
    requestId: string,
    currentUserId: string,
    skillName: string,
  ): Promise<void> {
    const request = await this.serviceRequestRepository.findById(requestId);

    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    if (request.customerId !== currentUserId) {
      throw new ForbiddenException(
        'You can only modify your own service requests',
      );
    }

    const skill = await this.skillRepository.findOrCreateByName(skillName);
    request.addSkill(skill.id);

    await this.serviceRequestRepository.update(request);
  }
}
