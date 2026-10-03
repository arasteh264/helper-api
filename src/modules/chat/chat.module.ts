import { Module } from '@nestjs/common';
import { AdminChatController } from './admin-chat.controller';
import { ChatService } from './chat.service';
import { ParticipantChatController } from './participant-chat.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ParticipantChatController, AdminChatController],
  providers: [ChatService],
})
export class ChatModule {}
