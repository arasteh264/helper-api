import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatService } from './chat.service';

type ChatPrismaMock = {
  serviceRequest: { findUnique: jest.Mock };
  providerProfile: { findUnique: jest.Mock };
  chatConversation: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
  };
  chatMessage: {
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  adminAuditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};

function createFixture() {
  const prisma: ChatPrismaMock = {
    serviceRequest: { findUnique: jest.fn() },
    providerProfile: { findUnique: jest.fn() },
    chatConversation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    chatMessage: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    adminAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const notifications = {
    createForUser: jest.fn().mockResolvedValue(null),
  };
  const service = new ChatService(
    prisma as unknown as PrismaService,
    notifications as never,
  );
  prisma.serviceRequest.findUnique.mockResolvedValue({
    id: 'request-1',
    title: 'تعمیرات',
    customerId: 'customer-1',
    acceptedProviderProfileId: 'provider-profile-1',
    status: 'CUSTOMER_CONFIRMATION_PENDING',
  });
  prisma.providerProfile.findUnique.mockResolvedValue({ userId: 'provider-1' });
  prisma.chatConversation.upsert.mockResolvedValue({
    id: 'conversation-1',
    status: 'ACTIVE',
  });
  prisma.chatMessage.create.mockResolvedValue({
    id: 'message-1',
    body: 'سلام',
  });
  return { prisma, service, notifications };
}

describe('ChatService', () => {
  it('lets a request participant send an in-platform message', async () => {
    const { prisma, service, notifications } = createFixture();

    await expect(
      service.sendMessage('request-1', 'customer-1', 'سلام، چه زمانی می‌رسید؟'),
    ).resolves.toMatchObject({ id: 'message-1' });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversationId: 'conversation-1',
          senderUserId: 'customer-1',
          body: 'سلام، چه زمانی می‌رسید؟',
        },
      }),
    );
    expect(notifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-1',
        chatMessageId: 'message-1',
      }),
    );
    expect(notifications.createForUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-1' }),
    );
  });

  it.each([
    'با من تماس بگیر 09123456789',
    'شماره ۰۹۱۲۳۴۵۶۷۸۹',
    'contact me at name@example.com',
    'بیا https://example.com',
    'تلگرام @helper_user',
  ])('blocks contact details in a message: %s', async (body) => {
    const { prisma, service } = createFixture();

    await expect(
      service.sendMessage('request-1', 'customer-1', body),
    ).rejects.toThrow(
      'ارسال شماره تماس، ایمیل، لینک یا شناسه شبکه اجتماعی مجاز نیست',
    );
    expect(prisma.serviceRequest.findUnique).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('does not allow users outside the assigned request to send messages', async () => {
    const { prisma, service } = createFixture();

    await expect(
      service.sendMessage('request-1', 'unrelated-user', 'سلام'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('does not allow sending while an admin has paused the conversation', async () => {
    const { prisma, service } = createFixture();
    prisma.chatConversation.upsert.mockResolvedValue({
      id: 'conversation-1',
      status: 'PAUSED',
    });

    await expect(
      service.sendMessage('request-1', 'customer-1', 'سلام'),
    ).rejects.toThrow('گفتگو توسط ادمین متوقف شده است');
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('returns admin conversation messages in pages with the total count', async () => {
    const { prisma, service } = createFixture();
    prisma.chatConversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: 'ACTIVE',
      pausedReason: null,
    });
    const messages = [{ id: 'message-21', body: 'سلام' }];
    prisma.$transaction.mockResolvedValue([messages, 41]);

    await expect(
      service.listAdminMessages('conversation-1', 2, 20),
    ).resolves.toMatchObject({
      conversation: { id: 'conversation-1' },
      messages,
      page: 2,
      pageSize: 20,
      total: 41,
    });
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
  });

  it('records conversation status changes atomically with the admin action', async () => {
    const { prisma, service } = createFixture();
    prisma.$transaction.mockImplementation(
      (callback: (transaction: ChatPrismaMock) => unknown) => callback(prisma),
    );
    prisma.chatConversation.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      pausedReason: null,
    });
    prisma.chatConversation.update.mockResolvedValue({
      id: 'conversation-1',
      status: 'PAUSED',
      pausedReason: 'درخواست بررسی',
      updatedAt: new Date(),
    });
    prisma.adminAuditLog.create.mockResolvedValue({});

    await service.setConversationStatus(
      'conversation-1',
      'admin-1',
      'PAUSED',
      'درخواست بررسی',
    );

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'CHAT_CONVERSATION_STATUS_CHANGED',
        targetType: 'CHAT',
        targetId: 'conversation-1',
        beforeState: { status: 'ACTIVE', pausedReason: null },
        afterState: { status: 'PAUSED', pausedReason: 'درخواست بررسی' },
      }),
    });
  });

  it('records message moderation atomically with the admin action', async () => {
    const { prisma, service } = createFixture();
    prisma.$transaction.mockImplementation(
      (callback: (transaction: ChatPrismaMock) => unknown) => callback(prisma),
    );
    prisma.chatMessage.findFirst.mockResolvedValue({
      status: 'VISIBLE',
      moderationNote: null,
    });
    prisma.chatMessage.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatMessage.findUniqueOrThrow.mockResolvedValue({
      id: 'message-1',
      status: 'HIDDEN',
      sender: { id: 'customer-1', name: 'مشتری', role: 'CUSTOMER' },
    });
    prisma.adminAuditLog.create.mockResolvedValue({});

    await service.moderateMessage(
      'conversation-1',
      'message-1',
      'admin-1',
      'HIDDEN',
      'محتوای نامرتبط',
    );

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'CHAT_MESSAGE_MODERATED',
        targetType: 'CHAT',
        targetId: 'message-1',
        reason: 'محتوای نامرتبط',
        beforeState: { status: 'VISIBLE', moderationNote: null },
        afterState: { status: 'HIDDEN', moderationNote: 'محتوای نامرتبط' },
      }),
    });
  });
});
