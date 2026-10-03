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
export class DeleteSpecialtyGroupUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(id: string): Promise<void> {
    const group = await this.specialtyRepository.findGroupById(id);
    if (!group) throw new NotFoundException('گروه یافت نشد');

    const specialtiesCount =
      await this.specialtyRepository.countSpecialtiesInGroup(id);
    if (specialtiesCount > 0) {
      throw new BadRequestException(
        'ابتدا تخصص‌های این گروه را حذف یا به گروه دیگری منتقل کنید',
      );
    }

    await this.specialtyRepository.deleteGroup(id);

    if (group.iconPublicId) {
      await this.iconStorage.deleteIcon(group.iconPublicId);
    }
  }
}