import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { UpdateNotificationPreferencesDto } from './notification-preferences.dto';
import { NotificationsQueryDto } from './notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('User Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  getPreferences(@CurrentUser() user: TokenPayload) {
    return this.notifications.getPreferences(user.userId);
  }

  @Put('notification-preferences')
  @ApiOperation({ summary: 'Replace my notification preferences' })
  updatePreferences(
    @CurrentUser() user: TokenPayload,
    @Body() input: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(user.userId, input);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List my notifications' })
  listNotifications(
    @CurrentUser() user: TokenPayload,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notifications.listForUser(
      user.userId,
      query.cursor,
      query.limit ?? 20,
    );
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Get my unread notification count' })
  unreadCount(@CurrentUser() user: TokenPayload) {
    return this.notifications.unreadCount(user.userId);
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  markAllRead(@CurrentUser() user: TokenPayload) {
    return this.notifications.markAllRead(user.userId);
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  markRead(
    @CurrentUser() user: TokenPayload,
    @Param('id') notificationId: string,
  ) {
    return this.notifications.markRead(user.userId, notificationId);
  }
}
