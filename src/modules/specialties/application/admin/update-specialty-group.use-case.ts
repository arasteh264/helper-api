import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SPECIALTY_REPOSITORY } from '../../domain/repositories/specialty.repository.token';
import type {
  ISpecialtyRepository,
  SpecialtyGroupRecord,
} from '../../domain/repositories/specialty.repository';
import { ICON_STORAGE } from '../../domain/services/icon-storage.token';
import type { IIconStorage } from '../../domain/services/icon-storage.port';

export interface UpdateSpecialtyGroupCommand {
  id: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
  iconFile?: Express.Multer.File;
}

@Injectable()
export class UpdateSpecialtyGroupUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(
    command: UpdateSpecialtyGroupCommand,
  ): Promise<SpecialtyGroupRecord> {
    const existing = await this.specialtyRepository.findGroupById(command.id);
    if (!existing) throw new NotFoundException('گروه یافت نشد');

    if (command.slug && command.slug !== existing.slug) {
      const groupWithSlug = await this.specialtyRepository.findGroupBySlug(
        command.slug,
      );
      if (groupWithSlug) {
        throw new ConflictException('این اسلاگ قبلاً استفاده شده است');
      }
    }

    let icon = existing.icon;
    let iconPublicId = existing.iconPublicId;
    let uploadedIcon: { url: string; publicId: string } | undefined;

    if (command.iconFile) {
      uploadedIcon = await this.iconStorage.uploadIcon(
        command.iconFile,
        'specialty-groups',
      );
      icon = uploadedIcon.url;
      iconPublicId = uploadedIcon.publicId;
    }

    let updated: SpecialtyGroupRecord;
    try {
      updated = await this.specialtyRepository.updateGroup(command.id, {
        name: command.name,
        slug: command.slug,
        sortOrder: command.sortOrder,
        isActive: command.isActive,
        icon,
        iconPublicId,
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
