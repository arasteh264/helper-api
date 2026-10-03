import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { SPECIALTY_REPOSITORY } from '../../domain/repositories/specialty.repository.token';
import type {
  ISpecialtyRepository,
  SpecialtyGroupRecord,
} from '../../domain/repositories/specialty.repository';
import { ICON_STORAGE } from '../../domain/services/icon-storage.token';
import type { IIconStorage } from '../../domain/services/icon-storage.port';

export interface CreateSpecialtyGroupCommand {
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
  iconFile?: Express.Multer.File;
}

@Injectable()
export class CreateSpecialtyGroupUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(
    command: CreateSpecialtyGroupCommand,
  ): Promise<SpecialtyGroupRecord> {
    const existing = await this.specialtyRepository.findGroupBySlug(
      command.slug,
    );
    if (existing) {
      throw new ConflictException('این اسلاگ قبلاً استفاده شده است');
    }

    let icon: string | null = null;
    let iconPublicId: string | null = null;

    if (command.iconFile) {
      const uploaded = await this.iconStorage.uploadIcon(
        command.iconFile,
        'specialty-groups',
      );
      icon = uploaded.url;
      iconPublicId = uploaded.publicId;
    }

    try {
      return await this.specialtyRepository.createGroup({
        name: command.name,
        slug: command.slug,
        sortOrder: command.sortOrder,
        isActive: command.isActive,
        icon,
        iconPublicId,
      });
    } catch (error) {
      if (iconPublicId) {
        await this.iconStorage.deleteIcon(iconPublicId).catch(() => undefined);
      }
      throw error;
    }
  }
}
