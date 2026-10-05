import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatService } from './chat.service';

type ChatPrismaMock = {
  serviceRequest: { findUnique: jest.Mock };
  providerProfile: { findUnique: jest.Mock };
  chatConversation: { findUnique: jest.Mock; upsert: jest.Mock };
  chatMessage: { count: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
};

function createFixture() {
  const prisma: ChatPrismaMock = {
    serviceRequest: { findUnique: jest.fn() },
    providerProfile: { findUnique: jest.fn() },
    chatConversation: { findUnique: jest.fn(), upsert: jest.fn() },
    chatMessage: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
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
});
