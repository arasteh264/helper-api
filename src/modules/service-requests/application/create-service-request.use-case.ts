import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
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
  skillName?: string;
  specialtyId?: string;
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
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreateServiceRequestInput): Promise<ServiceRequest> {
    if (!input.specialtyId && !input.skillName) {
      throw new BadRequestException('انتخاب تخصص برای ثبت درخواست الزامی است');
    }

    if (input.specialtyId) {
      const specialty = await this.prisma.specialty.findFirst({
        where: {
          id: input.specialtyId,
          isActive: true,
          group: { isActive: true },
        },
        select: { id: true },
      });
      if (!specialty) throw new NotFoundException('تخصص فعال پیدا نشد');
    }

    const request = ServiceRequest.create(
      input.customerId,
      input.title,
      input.description,
    );
    const reviewSettings = await this.prisma.walletConfiguration.findUnique({
      where: { id: 'global' },
      select: { requireServiceRequestReview: true },
    });

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
    if (input.specialtyId) request.setSpecialty(input.specialtyId);
    if (input.skillName) {
      const skill = await this.skillRepository.findOrCreateByName(
        input.skillName,
      );
      request.addSkill(skill.id);
    }
    if (reviewSettings?.requireServiceRequestReview ?? true) {
      request.holdForAdminReview();
    }

    await this.serviceRequestRepository.save(request);

    return request;
  }
}
