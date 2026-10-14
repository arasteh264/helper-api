import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { SendProviderStoryMessageDto } from '../../application/dto/provider-story-chat.dto';
import { ProviderStoryChatService } from '../../application/services/provider-story-chat.service';

@Controller('provider/stories')
@UseGuards(JwtAuthGuard)
export class ProviderStoryChatController {
  constructor(private readonly storyChat: ProviderStoryChatService) {}

  @Get('conversations')
  listProviderConversations(@CurrentUser() user: TokenPayload) {
    return this.storyChat.listProviderConversations(user.userId);
  }

  @Get('conversations/:conversationId/messages')
  getConversationMessages(
    @CurrentUser() user: TokenPayload,
    @Param('conversationId') conversationId: string,
  ) {
    return this.storyChat.getConversationMessages(user.userId, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendConversationMessage(
    @CurrentUser() user: TokenPayload,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendProviderStoryMessageDto,
  ) {
    return this.storyChat.sendConversationMessage(
      user.userId,
      conversationId,
      dto.body,
    );
  }

  @Get(':storyId/messages')
  getCustomerStoryMessages(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
  ) {
    return this.storyChat.getCustomerStoryMessages(user.userId, storyId);
  }

  @Post(':storyId/messages')
  sendCustomerStoryMessage(
    @CurrentUser() user: TokenPayload,
    @Param('storyId') storyId: string,
    @Body() dto: SendProviderStoryMessageDto,
  ) {
    return this.storyChat.sendCustomerStoryMessage(
      user.userId,
      storyId,
      dto.body,
    );
  }
}
