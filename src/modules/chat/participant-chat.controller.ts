import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { ChatService } from './chat.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@ApiTags('Service Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('service-requests/:requestId/chat')
export class ParticipantChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({
    summary: 'Get visible messages for my assigned service request',
  })
  @Get('messages')
  listMessages(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.chatService.listParticipantMessages(requestId, user.userId);
  }

  @ApiOperation({
    summary: 'Send a message to the assigned service provider/customer',
  })
  @Post('messages')
  sendMessage(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendMessage(requestId, user.userId, dto.body);
  }
}
