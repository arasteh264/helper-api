import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';

@Injectable()
export class SetProviderSpecialtiesUseCase {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  async execute(userId: string, specialtyIds: string[]) {
    const profile = await this.providerProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    const uniqueIds = [...new Set(specialtyIds)];
    if (uniqueIds.length !== specialtyIds.length) {
      throw new BadRequestException('تخصص تکراری در لیست انتخابی وجود دارد');
    }

    const activeIds =
      await this.providerProfileRepository.findActiveSpecialtyIds(uniqueIds);
    if (activeIds.length !== uniqueIds.length) {
      throw new BadRequestException(
        'یک یا چند تخصص انتخاب‌شده معتبر یا فعال نیست',
      );
    }

    await this.providerProfileRepository.replaceSpecialties(
      profile.id,
      uniqueIds,
    );

    return { specialtyIds: uniqueIds };
  }
}
