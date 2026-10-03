import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SPECIALTY_REPOSITORY } from '../../domain/repositories/specialty.repository.token';
import type { ISpecialtyRepository } from '../../domain/repositories/specialty.repository';
import { ICON_STORAGE } from '../../domain/services/icon-storage.token';
import type { IIconStorage } from '../../domain/services/icon-storage.port';

@Injectable()
export class DeleteSpecialtyUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(id: string): Promise<void> {
    const specialty = await this.specialtyRepository.findSpecialtyById(id);
    if (!specialty) throw new NotFoundException('تخصص یافت نشد');

    const providersCount =
      await this.specialtyRepository.countProvidersForSpecialty(id);
    if (providersCount > 0) {
      throw new BadRequestException(
        'سرویس‌دهنده‌ای با این تخصص وجود دارد. به‌جای حذف، آن را غیرفعال کنید',
      );
    }

    await this.specialtyRepository.deleteSpecialty(id);

    if (specialty.iconPublicId) {
      await this.iconStorage.deleteIcon(specialty.iconPublicId);
    }
  }
}