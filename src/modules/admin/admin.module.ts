import { Module } from '@nestjs/common';
import { AdminOperationsController } from './admin-operations.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminProviderStoriesController } from './presentation/controllers/admin-provider-stories.controller';
import { AdminProviderStoriesService } from './application/services/admin-provider-stories.service';
import { ProviderStoriesScheduler } from './application/schedulers/provider-stories.scheduler';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AdminOperationsController, AdminProviderStoriesController],
  providers: [AdminProviderStoriesService, ProviderStoriesScheduler],
})
export class AdminModule {}
