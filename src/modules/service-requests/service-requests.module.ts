import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { ServiceRequestController } from './presentation/controllers/service-request.controller';
import { CreateServiceRequestUseCase } from './application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from './application/add-skill-to-request.use-case';
import { SERVICE_REQUEST_REPOSITORY } from './domain/repositories/service-request.repository.token';
import { PrismaServiceRequestRepository } from './infrastructure/repositories/prisma-service-request.repository';
import { UploadServiceRequestImageUseCase } from './application/upload-service-request-image.use-case';

@Module({
  imports: [ProvidersModule],
  controllers: [ServiceRequestController],
  providers: [
    CreateServiceRequestUseCase,
    AddSkillToRequestUseCase,
    UploadServiceRequestImageUseCase,
    {
      provide: SERVICE_REQUEST_REPOSITORY,
      useClass: PrismaServiceRequestRepository,
    },
  ],
})
export class ServiceRequestsModule {}