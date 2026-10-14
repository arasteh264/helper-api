import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { ProviderGuard } from '../../../../common/guards/provider.guard';
import { ProviderStoriesService } from '../../application/services/provider-stories.service';
import {
  CreateProviderStoryDto,
  PrepareStoryUploadDto,
  ProviderStoryListResponseDto,
  ProviderStoryResponseDto,
  UpdateProviderStoryDto,
} from '../../application/dto/provider-story.dto';

@Controller('provider/stories')
@UseGuards(JwtAuthGuard, ProviderGuard)
export class ProviderStoriesController {
  constructor(private readonly storiesService: ProviderStoriesService) {}

  @Post('upload-signature')
  prepareUpload(
    @CurrentUser() user: TokenPayload,
    @Body() dto: PrepareStoryUploadDto,
  ) {
    return this.storiesService.prepareMediaUpload(user.userId, dto.mediaType);
  }

  @Post()
  createStory(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateProviderStoryDto,
  ): Promise<ProviderStoryResponseDto> {
    return this.storiesService.createStory(user.userId, dto);
  }

  @Patch(':storyId')
  updateStory(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
    @Body() dto: UpdateProviderStoryDto,
  ): Promise<ProviderStoryResponseDto> {
    return this.storiesService.updateStory(user.userId, storyId, dto);
  }

  @Post(':storyId/submit')
  submitStory(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
  ): Promise<ProviderStoryResponseDto> {
    return this.storiesService.submitStory(user.userId, storyId);
  }

  @Get()
  getStories(
    @CurrentUser() user: TokenPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ): Promise<ProviderStoryListResponseDto> {
    return this.storiesService.getProviderStories(
      user.userId,
      Number(page),
      Number(pageSize),
    );
  }

  @Get(':storyId/stats')
  getStoryStats(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
  ) {
    return this.storiesService.getStoryStats(user.userId, storyId);
  }

  @Post(':storyId/pay')
  payStory(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
  ) {
    return this.storiesService.payStory(user.userId, storyId);
  }

  @Delete(':storyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStory(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
  ): Promise<void> {
    return this.storiesService.deleteStory(user.userId, storyId);
  }
}
