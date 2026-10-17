import { Module } from '@nestjs/common';
import { ProviderProfileController } from './presentation/controllers/provider-profile.controller';
import { PROVIDER_PROFILE_REPOSITORY } from './domain/repositories/provider-profile.repository.token';
import { PrismaProviderProfileRepository } from './infrastructure/repositories/prisma-provider-profile.repository';
import { SKILL_REPOSITORY } from './domain/repositories/skill.repository.token';
import { PrismaSkillRepository } from './infrastructure/repositories/prisma-skill.repository';

import { StorageModule } from '../../shared/storage/storage.module';
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
import { PROVIDER_DOCUMENT_REPOSITORY } from './application/documents/provider-document.repository.token';
import { PrismaProviderDocumentRepository } from './infrastructure/repositories/prisma-provider-document.repository';
import { GetProviderDocumentsForReviewUseCase } from './application/documents/get-provider-documents-for-review.use-case';
import { ProviderJobsController } from './presentation/controllers/provider-jobs.controller';
import { ProviderJobsUseCase } from './application/provider-jobs.use-case';
import { PublicProvidersController } from './presentation/controllers/public-providers.controller';
import { CreateProviderProfileUseCase } from './application/profile/create-provider-profile.use-case';
import { AddSkillToProviderUseCase } from './application/skills/dd-skill-to-provider.use-case';
import { GetMyProviderProfileUseCase } from './application/profile/get-my-provider-profile.use-case';
import { UpdateProviderProfileUseCase } from './application/profile/update-provider-profile.use-case';
import { RemoveProviderAvatarUseCase } from './application/profile/remove-provider-avatar.use-case';
import { UploadProviderAvatarUseCase } from './application/profile/upload-provider-avatar.use-case';
import { RemoveSkillFromProviderUseCase } from './application/skills/remove-skill-from-provider.use-case';
import { UploadProviderDocumentUseCase } from './application/documents/upload-provider-document.use-case';
import { GetMyDocumentsUseCase } from './application/documents/get-my-documents.use-case';
import { ReviewProviderDocumentUseCase } from './application/documents/review-provider-document.use-case';
import { SetProviderSpecialtiesUseCase } from './application/specialties/set-provider-specialties.use-case';
import { NotificationsModule } from '../notifications/notifications.module';
import { GetAdminProviderInsightsUseCase } from './application/get-admin-provider-insights.use-case';
import { ProviderOnboardingController } from './presentation/controllers/provider-onboarding.controller';
import { ProviderOnboardingService } from './application/provider-onboarding.service';
import { SmsModule } from '../sms/sms.module';
import { TokenModule } from '../auth/token.module';
import { ProviderStoriesService } from './application/services/provider-stories.service';
import { PublicProviderStoriesService } from './application/services/public-provider-stories.service';
import { ProviderStoriesController } from './presentation/controllers/provider-stories.controller';
import { PublicProviderStoriesController } from './presentation/controllers/public-provider-stories.controller';
import { ProviderStoryChatController } from './presentation/controllers/provider-story-chat.controller';
import { ProviderStoryChatService } from './application/services/provider-story-chat.service';
import { ProviderReferralsService } from './application/provider-referrals.service';
import { ProviderReferralsController } from './presentation/controllers/provider-referrals.controller';

@Module({
  imports: [
    StorageModule,
    UsersModule,
    NotificationsModule,
    SmsModule,
    TokenModule,
  ],
  controllers: [
    ProviderProfileController,
    ProviderReferralsController,
    AdminProviderController,
    ProviderOnboardingController,
    ProviderJobsController,
    PublicProvidersController,
    // provider stories
    ProviderStoriesController,
    PublicProviderStoriesController,
    ProviderStoryChatController,
  ],
  providers: [
    // provider stories
    ProviderStoriesService,
    PublicProviderStoriesService,
    ProviderStoryChatService,
    ProviderReferralsService,

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
    SetProviderSpecialtiesUseCase,
    ProviderJobsUseCase,
    GetAdminProviderInsightsUseCase,
    ProviderOnboardingService,
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
  exports: [
    SKILL_REPOSITORY,
    ProviderStoriesService,
    PublicProviderStoriesService,
  ],
})
export class ProvidersModule {}
