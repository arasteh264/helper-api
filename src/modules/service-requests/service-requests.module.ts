import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { ServiceRequestController } from './presentation/controllers/service-request.controller';
import { PublicServiceCategoriesController } from './presentation/controllers/public-service-categories.controller';
import { CreateServiceRequestUseCase } from './application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from './application/add-skill-to-request.use-case';
import { SERVICE_REQUEST_REPOSITORY } from './domain/repositories/service-request.repository.token';
import { PrismaServiceRequestRepository } from './infrastructure/repositories/prisma-service-request.repository';
import { UploadServiceRequestImageUseCase } from './application/upload-service-request-image.use-case';
import { AdminServiceRequestController } from './presentation/controllers/admin-service-request.controller';
import { AdminListServiceRequestsUseCase } from './application/admin-list-service-requests.use-case';
import { ListMyServiceRequestsUseCase } from '../customers/application/list-my-service-requests.use-case';
import { MatchingModule } from '../matching/matching.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminServiceRequestActionsUseCases } from './application/admin-service-request-actions.use-cases';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ProvidersModule, MatchingModule, PaymentsModule, NotificationsModule],
  controllers: [
    PublicServiceCategoriesController,
    ServiceRequestController,
    AdminServiceRequestController,
  ],
  providers: [
    CreateServiceRequestUseCase,
    AddSkillToRequestUseCase,
    UploadServiceRequestImageUseCase,
    AdminListServiceRequestsUseCase,
    AdminServiceRequestActionsUseCases,
    ListMyServiceRequestsUseCase,
    {
      provide: SERVICE_REQUEST_REPOSITORY,
      useClass: PrismaServiceRequestRepository,
    },
  ],
  exports: [ListMyServiceRequestsUseCase],
})
export class ServiceRequestsModule {}
