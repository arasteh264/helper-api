import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdminProviderStoriesService } from '../services/admin-provider-stories.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class ProviderStoriesScheduler {
  private readonly logger = new Logger(ProviderStoriesScheduler.name);

  constructor(
    private readonly adminStoriesService: AdminProviderStoriesService,
  ) {}

  @Cron('*/10 * * * *')
  async handleStoryExpiry() {
    try {
      const expiredCount = await this.adminStoriesService.expireStories();
      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} stories`);
      }
    } catch (error) {
      this.logger.error(`Error expiring stories: ${error.message}`);
    }
  }
}
