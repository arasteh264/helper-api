import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import {
  AdminProviderStoriesService,
  SetProviderStoryAccessDto,
} from '../../application/services/admin-provider-stories.service';

class ApproveStoryBody {
  @IsOptional()
  @IsString()
  comment?: string;
}

class RejectStoryBody {
  @IsString()
  @MinLength(1)
  rejectionReason: string;
}

class PricingBody {
  @IsBoolean()
  isPaid: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceToman: number;
}

class StoryAccessBody implements SetProviderStoryAccessDto {
  @IsBoolean()
  canPublishStories: boolean;

  @IsBoolean()
  canViewStoryStats: boolean;
}

class StoryUploadSettingsBody {
  @IsInt()
  @Min(1)
  @Max(100)
  videoMaxSizeMB: number;
}

@Controller('admin/provider-stories')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminProviderStoriesController {
  constructor(private readonly storiesService: AdminProviderStoriesService) {}

  @Get()
  getStories(
    @Query('status')
    status?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED',
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.storiesService.getStories({ status, page, pageSize });
  }

  @Get('providers')
  listProviderAccess(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('search') search?: string,
  ) {
    return this.storiesService.listProviderAccess(page, pageSize, search);
  }

  @Patch('providers/:providerProfileId/access')
  setProviderAccess(
    @CurrentUser() admin: TokenPayload,
    @Param('providerProfileId') providerProfileId: string,
    @Body() body: StoryAccessBody,
  ) {
    return this.storiesService.setProviderAccess(
      providerProfileId,
      admin.userId,
      body,
    );
  }

  @Post(':storyId/approve')
  approveStory(
    @CurrentUser() admin: TokenPayload,
    @Param('storyId') storyId: string,
    @Body() body: ApproveStoryBody,
  ) {
    return this.storiesService.approveStory(storyId, admin.userId, body);
  }

  @Post(':storyId/reject')
  rejectStory(
    @CurrentUser() admin: TokenPayload,
    @Param('storyId') storyId: string,
    @Body() body: RejectStoryBody,
  ) {
    return this.storiesService.rejectStory(storyId, admin.userId, body);
  }

  @Post(':storyId/pricing')
  setStoryPricing(
    @CurrentUser() admin: TokenPayload,
    @Param('storyId') storyId: string,
    @Body() body: PricingBody,
  ) {
    return this.storiesService.setStoryPricing(storyId, admin.userId, body);
  }

  @Get('financial-report')
  getFinancialReport() {
    return this.storiesService.getFinancialReport();
  }

  @Get('upload-settings')
  getStoryUploadSettings() {
    return this.storiesService.getStoryUploadSettings();
  }

  @Patch('upload-settings')
  setStoryUploadSettings(
    @CurrentUser() admin: TokenPayload,
    @Body() body: StoryUploadSettingsBody,
  ) {
    return this.storiesService.setStoryUploadSettings(
      body.videoMaxSizeMB,
      admin.userId,
    );
  }

  @Get(':storyId/approval-log')
  getApprovalLog(@Param('storyId') storyId: string) {
    return this.storiesService.getStoryApprovalLog(storyId);
  }
}
