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
import { GetApprovedProvidersUseCase } from './application/get-approved-providers.use-case';

import { CreatePortfolioItemUseCase } from './application/portfolio/create-portfolio-item.use-case';
import { DeletePortfolioItemUseCase } from './application/portfolio/delete-portfolio-item.use-case';
import { AddImageToPortfolioItemUseCase } from './application/portfolio/add-image-to-portfolio-item.use-case';
import { DeletePortfolioItemImageUseCase } from './application/portfolio/delete-portfolio-item-image.use-case';
import { PORTFOLIO_ITEM_REPOSITORY } from './domain/repositories/portfolio-item.repository.token';
import { PrismaPortfolioItemRepository } from './infrastructure/repositories/prisma-portfolio-item.repository';
import { GetMyPortfolioUseCase } from './application/portfolio/get-my-portfolio.use-case';
import { PROVIDER_DOCUMENT_REPOSITORY } from './application/provider-document.repository.token';
import { PrismaProviderDocumentRepository } from './infrastructure/repositories/prisma-provider-document.repository';
import { UploadProviderDocumentUseCase } from './application/upload-provider-document.use-case';
import { GetMyDocumentsUseCase } from './application/get-my-documents.use-case';
import { GetProviderDocumentsForReviewUseCase } from './application/get-provider-documents-for-review.use-case';
import { ReviewProviderDocumentUseCase } from './application/review-provider-document.use-case';

@Module({
  imports: [StorageModule, UsersModule],
  controllers: [ProviderProfileController, AdminProviderController],
  providers: [
    CreateProviderProfileUseCase,
    AddSkillToProviderUseCase,
    GetMyProviderProfileUseCase,
    GetApprovedProvidersUseCase,
    UpdateProviderProfileUseCase,
    RemoveSkillFromProviderUseCase,
    UploadProviderAvatarUseCase,
    RemoveProviderAvatarUseCase,
    CreatePortfolioItemUseCase,
    GetMyPortfolioUseCase,
    DeletePortfolioItemUseCase,
    AddImageToPortfolioItemUseCase,
    DeletePortfolioItemImageUseCase,
    UploadProviderDocumentUseCase,
    GetMyDocumentsUseCase,
    GetProviderDocumentsForReviewUseCase,
    ReviewProviderDocumentUseCase,
    {
      provide: PROVIDER_PROFILE_REPOSITORY,
      useClass: PrismaProviderProfileRepository,
    },
    {
      provide: SKILL_REPOSITORY,
      useClass: PrismaSkillRepository,
    },
    {
      provide: PORTFOLIO_ITEM_REPOSITORY,
      useClass: PrismaPortfolioItemRepository,
    },
    {
      provide: PROVIDER_DOCUMENT_REPOSITORY,
      useClass: PrismaProviderDocumentRepository,
    },
  ],
  exports: [SKILL_REPOSITORY],
})
export class ProvidersModule {}
