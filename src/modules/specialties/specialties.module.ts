import { Module } from '@nestjs/common';
import { SpecialtiesController } from './presentation/specialties.controller';
import { AdminSpecialtiesController } from './presentation/admin-specialties.controller';
import { GetGroupedSpecialtiesUseCase } from './application/get-grouped-specialties.use-case';
import { CreateSpecialtyGroupUseCase } from './application/admin/create-specialty-group.use-case';
import { UpdateSpecialtyGroupUseCase } from './application/admin/update-specialty-group.use-case';
import { DeleteSpecialtyGroupUseCase } from './application/admin/delete-specialty-group.use-case';
import { CreateSpecialtyUseCase } from './application/admin/create-specialty.use-case';
import { UpdateSpecialtyUseCase } from './application/admin/update-specialty.use-case';
import { DeleteSpecialtyUseCase } from './application/admin/delete-specialty.use-case';
import { SPECIALTY_REPOSITORY } from './domain/repositories/specialty.repository.token';
import { PrismaSpecialtyRepository } from './infrastructure/prisma-specialty.repository';
import { ICON_STORAGE } from './domain/services/icon-storage.token';
import { CloudinaryIconStorage } from './infrastructure/cloudinary-icon-storage';

@Module({
  controllers: [SpecialtiesController, AdminSpecialtiesController],
  providers: [
    GetGroupedSpecialtiesUseCase,
    CreateSpecialtyGroupUseCase,
    UpdateSpecialtyGroupUseCase,
    DeleteSpecialtyGroupUseCase,
    CreateSpecialtyUseCase,
    UpdateSpecialtyUseCase,
    DeleteSpecialtyUseCase,
    {
      provide: SPECIALTY_REPOSITORY,
      useClass: PrismaSpecialtyRepository,
    },
    {
      provide: ICON_STORAGE,
      useClass: CloudinaryIconStorage,
    },
  ],
})
export class SpecialtiesModule {}