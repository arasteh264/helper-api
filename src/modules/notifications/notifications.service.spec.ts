import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { NotificationsService } from './notifications.service';

function createFixture() {
  let preferences: Record<string, unknown> | null = null;
  const prisma = {
    notificationPreference: {
      findUnique: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          preferences?.userId === where.userId ? preferences : null,
        ),
      ),
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) => {
        preferences = create;
        return Promise.resolve(create);
      }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'user@example.test',
        phone: '09120000000',
        notificationPreference: null,
      }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(3),
      findFirst: jest.fn().mockResolvedValue({
        id: 'notification-1',
        readAt: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const smsService = {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  };
  const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    smsService as never,
    emailSender as never,
  );
  return { prisma, service, smsService, emailSender };
}

describe('NotificationsService', () => {
  it('returns the specified defaults when preferences are not saved', async () => {
    const { service, prisma } = createFixture();

    await expect(service.getPreferences('user-1')).resolves.toEqual({
      messages: { inApp: true, sms: false, email: false },
      workUpdates: { inApp: true, sms: false, email: false },
      opportunities: { inApp: true, sms: false, email: false },
      payments: { inApp: true, sms: false, email: false },
      promotions: { inApp: false, sms: false, email: false },
    });
    expect(prisma.notificationPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('persists and reads preferences scoped to the authenticated user id', async () => {
    const { service, prisma } = createFixture();
    const input = {
      messages: { inApp: false, sms: true, email: false },
      workUpdates: { inApp: true, sms: false, email: true },
      opportunities: { inApp: true, sms: true, email: false },
      payments: { inApp: false, sms: false, email: true },
      promotions: { inApp: false, sms: false, email: false },
    };

    await expect(service.updatePreferences('user-1', input)).resolves.toEqual(
      input,
    );
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        create: expect.objectContaining({
          userId: 'user-1',
          messagesInApp: false,
          messagesSms: true,
          workUpdatesEmail: true,
          paymentsEmail: true,
          promotionsInApp: false,
        }),
      }),
    );
  });

  it('scopes notification list, unread count, and read updates to one user', async () => {
    const { service, prisma } = createFixture();

    await service.listForUser('user-1', undefined, 10);
    await expect(service.unreadCount('user-1')).resolves.toEqual({ count: 3 });
    await service.markRead('user-1', 'notification-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          OR: expect.arrayContaining([
            { chatMessageId: null },
            { chatMessage: { is: { status: 'VISIBLE' } } },
          ]),
        }),
      }),
    );
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 'user-1',
        readAt: null,
        OR: expect.arrayContaining([
          { chatMessageId: null },
          { chatMessage: { is: { status: 'VISIBLE' } } },
        ]),
      }),
    });
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'notification-1', userId: 'user-1' },
      select: { id: true, readAt: true },
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-1', userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('does not mark another user notification as read', async () => {
    const { service, prisma } = createFixture();
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markRead('user-1', 'someone-elses-notification'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('marks all notifications read for only the requested user', async () => {
    const { service, prisma } = createFixture();

    await service.markAllRead('user-1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('honors recipient preferences for in-app and SMS delivery', async () => {
    const { service, prisma, smsService, emailSender } = createFixture();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.test',
      phone: '09120000000',
      notificationPreference: {
        messagesInApp: false,
        messagesSms: true,
        messagesEmail: false,
      },
    });

    await service.createForUser({
      userId: 'user-1',
      category: 'MESSAGES',
      type: 'CHAT_MESSAGE',
      title: 'پیام جدید',
      body: 'یک پیام جدید دارید.',
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(smsService.sendNotification).toHaveBeenCalledWith(
      '09120000000',
      'یک پیام جدید دارید.',
    );
    expect(emailSender.send).not.toHaveBeenCalled();
  });
});
