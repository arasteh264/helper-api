import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { ChatService } from './chat.service';
import { ListChatConversationsQueryDto } from './dto/list-chat-conversations-query.dto';
import { ListChatMessagesQueryDto } from './dto/list-chat-messages-query.dto';
import { ModerateChatMessageDto } from './dto/moderate-chat-message.dto';
import { UpdateChatConversationDto } from './dto/update-chat-conversation.dto';

@ApiTags('Admin - Chat Moderation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/chats')
export class AdminChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({ summary: 'List all service conversations for moderation' })
  @Get()
  list(@Query() query: ListChatConversationsQueryDto) {
    return this.chatService.listAdminConversations(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.status,
    );
  }

  @ApiOperation({
    summary: 'List conversation messages, including hidden messages',
  })
  @Get(':conversationId')
  getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: ListChatMessagesQueryDto,
  ) {
    return this.chatService.listAdminMessages(
      conversationId,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @ApiOperation({ summary: 'Pause, resume or close a conversation' })
  @Patch(':conversationId')
  setConversationStatus(
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateChatConversationDto,
  ) {
    return this.chatService.setConversationStatus(
      conversationId,
      dto.status,
      dto.pausedReason,
    );
  }

  @ApiOperation({
    summary: 'Hide or restore a message and record the moderation action',
  })
  @Patch(':conversationId/messages/:messageId')
  moderateMessage(
    @CurrentUser() admin: TokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ModerateChatMessageDto,
  ) {
    return this.chatService.moderateMessage(
      conversationId,
      messageId,
      admin.userId,
      dto.status,
      dto.note,
    );
  }
}
