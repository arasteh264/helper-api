import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { ServiceRequestController } from './presentation/controllers/service-request.controller';
import { CreateServiceRequestUseCase } from './application/create-service-request.use-case';
import { AddSkillToRequestUseCase } from './application/add-skill-to-request.use-case';
import { SERVICE_REQUEST_REPOSITORY } from './domain/repositories/service-request.repository.token';
import { PrismaServiceRequestRepository } from './infrastructure/repositories/prisma-service-request.repository';

@Module({
  imports: [ProvidersModule],
  controllers: [ServiceRequestController],
  providers: [
    CreateServiceRequestUseCase,
    AddSkillToRequestUseCase,
    {
      provide: SERVICE_REQUEST_REPOSITORY,
      useClass: PrismaServiceRequestRepository,
    },
  ],
})
export class ServiceRequestsModule {}