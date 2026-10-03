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

export interface CreateSpecialtyCommand {
  groupId: string;
  name: string;
  slug: string;
  sortOrder?: number;
  isActive?: boolean;
  pricingMode?: 'QUOTE' | 'HOURLY';
  hourlyRateToman?: number;
  hourlyUnitLabel?: string;
  iconFile?: Express.Multer.File;
}

@Injectable()
export class CreateSpecialtyUseCase {
  constructor(
    @Inject(SPECIALTY_REPOSITORY)
    private readonly specialtyRepository: ISpecialtyRepository,
    @Inject(ICON_STORAGE)
    private readonly iconStorage: IIconStorage,
  ) {}

  async execute(command: CreateSpecialtyCommand): Promise<SpecialtyRecord> {
    if (
      command.pricingMode === 'HOURLY' &&
      (!command.hourlyRateToman || command.hourlyRateToman <= 0)
    ) {
      throw new BadRequestException('نرخ ساعتی برای این تخصص الزامی است');
    }
    const group = await this.specialtyRepository.findGroupById(command.groupId);
    if (!group) throw new NotFoundException('گروه مورد نظر یافت نشد');

    const existing = await this.specialtyRepository.findSpecialtyBySlug(
      command.slug,
    );
    if (existing)
      throw new ConflictException('این اسلاگ قبلاً استفاده شده است');

    let icon: string | null = null;
    let iconPublicId: string | null = null;

    if (command.iconFile) {
      const uploaded = await this.iconStorage.uploadIcon(
        command.iconFile,
        'specialties',
      );
      icon = uploaded.url;
      iconPublicId = uploaded.publicId;
    }

    try {
      return await this.specialtyRepository.createSpecialty({
        groupId: command.groupId,
        name: command.name,
        slug: command.slug,
        sortOrder: command.sortOrder,
        isActive: command.isActive,
        icon,
        iconPublicId,
        pricingMode: command.pricingMode ?? 'QUOTE',
        hourlyRateToman: command.hourlyRateToman ?? null,
        hourlyUnitLabel: command.hourlyUnitLabel ?? null,
      });
    } catch (error) {
      if (iconPublicId) {
        await this.iconStorage.deleteIcon(iconPublicId).catch(() => undefined);
      }
      throw error;
    }
  }
}
