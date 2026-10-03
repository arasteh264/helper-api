import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SPECIALTY_REPOSITORY } from '../../domain/repositories/specialty.repository.token';
import type {
  ISpecialtyRepository,
  SpecialtyRecord,
} from '../../domain/repositories/specialty.repository';
import { ICON_STORAGE } from '../../domain/services/icon-storage.token';
import type { IIconStorage } from '../../domain/services/icon-storage.port';

export interface UpdateSpecialtyCommand {
  id: string;
  groupId?: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
  pricingMode?: 'QUOTE' | 'HOURLY';
  hourlyRateToman?: number;
  hourlyUnitLabel?: string;
  iconFile?: Express.Multer.File;
}

@Injectable()
export class UpdateSpecialtyUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(command: UpdateSpecialtyCommand): Promise<SpecialtyRecord> {
    const existing = await this.specialtyRepository.findSpecialtyById(
      command.id,
    );
    if (!existing) throw new NotFoundException('تخصص یافت نشد');

    if (
      command.pricingMode === 'HOURLY' &&
      !(command.hourlyRateToman ?? existing.hourlyRateToman)
    ) {
      throw new BadRequestException('نرخ ساعتی برای این تخصص الزامی است');
    }

    if (command.slug && command.slug !== existing.slug) {
      const specialtyWithSlug =
        await this.specialtyRepository.findSpecialtyBySlug(command.slug);
      if (specialtyWithSlug) {
        throw new ConflictException('این اسلاگ قبلاً استفاده شده است');
      }
    }

    if (command.groupId) {
      const group = await this.specialtyRepository.findGroupById(
        command.groupId,
      );
      if (!group) throw new NotFoundException('گروه مورد نظر یافت نشد');
    }

    let icon = existing.icon;
    let iconPublicId = existing.iconPublicId;
    let uploadedIcon: { url: string; publicId: string } | undefined;

    if (command.iconFile) {
      uploadedIcon = await this.iconStorage.uploadIcon(
        command.iconFile,
        'specialties',
      );
      icon = uploadedIcon.url;
      iconPublicId = uploadedIcon.publicId;
    }

    let updated: SpecialtyRecord;
    try {
      updated = await this.specialtyRepository.updateSpecialty(command.id, {
        groupId: command.groupId,
        name: command.name,
        slug: command.slug,
        sortOrder: command.sortOrder,
        isActive: command.isActive,
        icon,
        iconPublicId,
        pricingMode: command.pricingMode,
        hourlyRateToman:
          command.pricingMode === 'QUOTE' ? null : command.hourlyRateToman,
        hourlyUnitLabel:
          command.pricingMode === 'QUOTE' ? null : command.hourlyUnitLabel,
      });
    } catch (error) {
      if (uploadedIcon) {
        await this.iconStorage
          .deleteIcon(uploadedIcon.publicId)
          .catch(() => undefined);
      }
      throw error;
    }

    if (uploadedIcon && existing.iconPublicId) {
      await this.iconStorage.deleteIcon(existing.iconPublicId);
    }
    return updated;
  }
}
