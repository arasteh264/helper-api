import { Module } from '@nestjs/common';
import { ProviderProfileController } from './presentation/controllers/provider-profile.controller';
import { CreateProviderProfileUseCase } from './application/create-provider-profile.use-case';
import { PROVIDER_PROFILE_REPOSITORY } from './domain/repositories/provider-profile.repository.token';
import { PrismaProviderProfileRepository } from './infrastructure/repositories/prisma-provider-profile.repository';
import { SKILL_REPOSITORY } from './domain/repositories/skill.repository.token';
import { PrismaSkillRepository } from './infrastructure/repositories/prisma-skill.repository';
import { AddSkillToProviderUseCase } from './application/dd-skill-to-provider.use-case';
import { GetMyProviderProfileUseCase } from './application/get-my-provider-profile.use-case';
import { UpdateProviderProfileUseCase } from './application/update-provider-profile.use-case';
import { StorageModule } from '../../shared/storage/storage.module';
import { UploadProviderAvatarUseCase } from './application/upload-provider-avatar.use-case';
import { RemoveProviderAvatarUseCase } from './application/remove-provider-avatar.use-case';
import { RemoveSkillFromProviderUseCase } from './application/remove-skill-from-provider.use-case';
import { AdminProviderController } from './presentation/controllers/admin-provider.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [StorageModule, UsersModule],
  controllers: [ProviderProfileController, AdminProviderController],
  providers: [
    CreateProviderProfileUseCase,
    AddSkillToProviderUseCase,
    GetMyProviderProfileUseCase,
    UpdateProviderProfileUseCase,
    RemoveSkillFromProviderUseCase,
    UploadProviderAvatarUseCase,
    RemoveProviderAvatarUseCase,
    {
      provide: PROVIDER_PROFILE_REPOSITORY,
      useClass: PrismaProviderProfileRepository,
    },
    {
      provide: SKILL_REPOSITORY,
      useClass: PrismaSkillRepository,
    },
  ],
  exports: [SKILL_REPOSITORY],
})
export class ProvidersModule {}
