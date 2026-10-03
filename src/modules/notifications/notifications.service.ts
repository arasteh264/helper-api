import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import { EMAIL_SENDER } from '../auth/domain/services/email-sender.token';
import type { EmailSender } from '../auth/domain/services/email-sender.port';
import { SmsService } from '../sms/sms.service';
import type { UpdateNotificationPreferencesDto } from './notification-preferences.dto';

export type NotificationCategory =
  'MESSAGES' | 'WORK_UPDATES' | 'OPPORTUNITIES' | 'PAYMENTS' | 'PROMOTIONS';

export type NotificationType =
  | 'CHAT_MESSAGE'
  | 'SERVICE_REQUEST_STATUS'
  | 'PROVIDER_OFFER'
  | 'NEW_OPPORTUNITY'
  | 'PAYMENT_UPDATE';

export interface NotificationContent {
  userId: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  body: string;
  serviceRequestId?: string;
  chatMessageId?: string;
}

const DEFAULT_PREFERENCES = {
  messages: { inApp: true, sms: false, email: false },
  workUpdates: { inApp: true, sms: false, email: false },
  opportunities: { inApp: true, sms: false, email: false },
  payments: { inApp: true, sms: false, email: false },
  promotions: { inApp: false, sms: false, email: false },
} as const;

const CATEGORY_KEYS: Record<
  NotificationCategory,
  keyof typeof DEFAULT_PREFERENCES
> = {
  MESSAGES: 'messages',
  WORK_UPDATES: 'workUpdates',
  OPPORTUNITIES: 'opportunities',
  PAYMENTS: 'payments',
  PROMOTIONS: 'promotions',
};

const PREFERENCE_FIELDS: Record<
  keyof typeof DEFAULT_PREFERENCES,
  { inApp: string; sms: string; email: string }
> = {
  messages: {
    inApp: 'messagesInApp',
    sms: 'messagesSms',
    email: 'messagesEmail',
  },
  workUpdates: {
    inApp: 'workUpdatesInApp',
    sms: 'workUpdatesSms',
    email: 'workUpdatesEmail',
  },
  opportunities: {
    inApp: 'opportunitiesInApp',
    sms: 'opportunitiesSms',
    email: 'opportunitiesEmail',
  },
  payments: {
    inApp: 'paymentsInApp',
    sms: 'paymentsSms',
    email: 'paymentsEmail',
  },
  promotions: {
    inApp: 'promotionsInApp',
    sms: 'promotionsSms',
    email: 'promotionsEmail',
  },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async getPreferences(userId: string) {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!preferences) return DEFAULT_PREFERENCES;

    return Object.fromEntries(
      Object.entries(PREFERENCE_FIELDS).map(([key, fields]) => [
        key,
        {
          inApp: preferences[fields.inApp as keyof typeof preferences],
          sms: preferences[fields.sms as keyof typeof preferences],
          email: preferences[fields.email as keyof typeof preferences],
        },
      ]),
    );
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesDto,
  ) {
    const data: Record<string, boolean> = {};
    for (const [key, fields] of Object.entries(PREFERENCE_FIELDS)) {
      const value = input[key as keyof typeof input];
      data[fields.inApp] = value.inApp;
      data[fields.sms] = value.sms;
      data[fields.email] = value.email;
    }
    await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.getPreferences(userId);
  }

  async createForUser(input: NotificationContent) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        notificationPreference: true,
      },
    });
    if (!recipient) return null;

    const key = CATEGORY_KEYS[input.category];
    const fields = PREFERENCE_FIELDS[key];
    const preferences = recipient.notificationPreference;
    const channels = preferences
      ? {
          inApp: preferences[
            fields.inApp as keyof typeof preferences
          ] as boolean,
          sms: preferences[fields.sms as keyof typeof preferences] as boolean,
          email: preferences[
            fields.email as keyof typeof preferences
          ] as boolean,
        }
      : DEFAULT_PREFERENCES[key];

    const notification = channels.inApp
      ? await this.prisma.notification.create({
          data: {
            userId: recipient.id,
            category: input.category,
            type: input.type,
            title: input.title,
            body: input.body,
            serviceRequestId: input.serviceRequestId,
            chatMessageId: input.chatMessageId,
          },
        })
      : null;

    const deliveries: Promise<void>[] = [];
    if (channels.sms) {
      deliveries.push(
        this.smsService.sendNotification(recipient.phone, input.body),
      );
    }
    if (channels.email) {
      deliveries.push(
        this.emailSender.send(
          recipient.email,
          input.title,
          `<p>${this.escapeHtml(input.body)}</p>`,
        ),
      );
    }
    const results = await Promise.allSettled(deliveries);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Notification delivery failed for user ${recipient.id}`,
          result.reason instanceof Error ? result.reason.stack : undefined,
        );
      }
    }

    return notification;
  }

  async listForUser(userId: string, cursor: string | undefined, limit: number) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = {
      userId,
      OR: [
        { chatMessageId: null },
        { chatMessage: { is: { status: 'VISIBLE' as const } } },
      ],
    };
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > safeLimit;
    const items = rows.slice(0, safeLimit);
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      hasMore,
      limit: safeLimit,
    };
  }

  unreadCount(userId: string) {
    return this.prisma.notification
      .count({
        where: {
          userId,
          readAt: null,
          OR: [
            { chatMessageId: null },
            { chatMessage: { is: { status: 'VISIBLE' } } },
          ],
        },
      })
      .then((count) => ({ count }));
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, readAt: true },
    });
    if (!existing) throw new NotFoundException('اعلان پیدا نشد');
    if (existing.readAt) return { id: existing.id, read: true };

    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { id: existing.id, read: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character]!,
    );
  }
}
