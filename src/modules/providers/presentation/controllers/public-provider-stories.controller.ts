import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import type { Request } from 'express';
import { PublicProviderStoriesService } from '../../application/services/public-provider-stories.service';

@Controller('public/provider-stories')
export class PublicProviderStoriesController {
  constructor(private readonly storiesService: PublicProviderStoriesService) {}

  @Get('providers/:providerId')
  getProviderStories(@Param('providerId') providerId: string) {
    return this.storiesService.getProviderStories(providerId);
  }

  @Post(':storyId/view')
  async recordView(@Param('storyId') storyId: string, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || 'unknown';
    const secret = process.env.STORY_VIEW_HASH_SECRET || process.env.JWT_SECRET;
    const ipAddress = secret
      ? createHmac('sha256', secret).update(ip).digest('hex')
      : createHash('sha256').update(ip).digest('hex');
    await this.storiesService.recordStoryView({ storyId, ipAddress });
    return { recorded: true };
  }

  @Get('recent')
  getRecentStories(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.storiesService.getRecentStories(limit || 20);
  }
}
