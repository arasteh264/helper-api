import { Module } from '@nestjs/common';
import { ProviderProfileController } from './presentation/controllers/provider-profile.controller';
import { CreateProviderProfileUseCase } from './application/create-provider-profile.use-case';
import { PROVIDER_PROFILE_REPOSITORY } from './domain/repositories/provider-profile.repository.token';
import { PrismaProviderProfileRepository } from './infrastructure/repositories/prisma-provider-profile.repository';
import { SKILL_REPOSITORY } from './domain/repositories/skill.repository.token';
import { PrismaSkillRepository } from './infrastructure/repositories/prisma-skill.repository';
import { AddSkillToProviderUseCase } from './application/dd-skill-to-provider.use-case';

@Module({
  controllers: [ProviderProfileController],
  providers: [
    CreateProviderProfileUseCase,
    AddSkillToProviderUseCase,
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
