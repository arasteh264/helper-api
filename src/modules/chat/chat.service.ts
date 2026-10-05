import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import { NotificationsService } from '../notifications/notifications.service';

const ACTIVE_CHAT_STATUSES = [
  'CUSTOMER_CONFIRMATION_PENDING',
  'OFFER_ACCEPTED',
  'IN_PROGRESS',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'DISPUTED',
];

@Injectable()
export class ChatService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listParticipantMessages(requestId: string, userId: string) {
    const { conversation } = await this.getParticipantConversation(
      requestId,
      userId,
      true,
    );
    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id, status: 'VISIBLE' },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return {
      conversationId: conversation.id,
      status: conversation.status,
      messages,
    };
  }

  async sendMessage(requestId: string, userId: string, body: string) {
    const normalizedBody = body.trim();
    if (!normalizedBody) throw new BadRequestException('متن پیام خالی است');
    if (normalizedBody.length > 2000) {
      throw new BadRequestException('حداکثر طول پیام ۲۰۰۰ نویسه است');
    }
    if (this.containsContactInformation(normalizedBody)) {
      throw new BadRequestException(
        'ارسال شماره تماس، ایمیل، لینک یا شناسه شبکه اجتماعی مجاز نیست؛ گفتگو داخل سامانه انجام شود',
      );
    }

    const { request, conversation } = await this.getParticipantConversation(
      requestId,
      userId,
      true,
    );
    if (conversation.status !== 'ACTIVE') {
      throw new ForbiddenException('گفتگو توسط ادمین متوقف شده است');
    }
    if (!ACTIVE_CHAT_STATUSES.includes(request.status)) {
      throw new ForbiddenException('گفتگو برای این درخواست فعال نیست');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: userId,
        body: normalizedBody,
      },
      include: { sender: { select: { id: true, name: true } } },
    });
    const recipientUserId =
      request.customerId === userId
        ? request.providerUserId
        : request.customerId;
    if (recipientUserId !== userId) {
      await this.notifications.createForUser({
        userId: recipientUserId,
        category: 'MESSAGES',
        type: 'CHAT_MESSAGE',
        title: 'پیام جدید در گفتگوی درخواست',
        body: `درخواست «${request.title}» یک پیام جدید دارد.`,
        serviceRequestId: request.id,
        chatMessageId: message.id,
      });
    }
    return message;
  }

  async listAdminConversations(
    page: number,
    pageSize: number,
    status?: string,
  ) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = status
      ? { status: status as 'ACTIVE' | 'PAUSED' | 'CLOSED' }
      : {};
    const [conversations, total] = await this.prisma.$transaction([
      this.prisma.chatConversation.findMany({
        where,
        include: {
          serviceRequest: {
            select: {
              id: true,
              title: true,
              status: true,
              customerId: true,
              acceptedProviderProfile: {
                select: { user: { select: { name: true } } },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { name: true } } },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.chatConversation.count({ where }),
    ]);
    const customerIds = [
      ...new Set(conversations.map((item) => item.serviceRequest.customerId)),
    ];
    const customers = customerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
    const customerNames = new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );

    return {
      items: conversations.map((conversation) => ({
        id: conversation.id,
        status: conversation.status,
        pausedReason: conversation.pausedReason,
        serviceRequestId: conversation.serviceRequest.id,
        requestTitle: conversation.serviceRequest.title,
        requestStatus: conversation.serviceRequest.status,
        customerName:
          customerNames.get(conversation.serviceRequest.customerId) ?? null,
        providerName:
          conversation.serviceRequest.acceptedProviderProfile?.user.name ??
          null,
        messageCount: conversation._count.messages,
        lastMessage: conversation.messages[0] ?? null,
        updatedAt: conversation.updatedAt,
      })),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async listAdminMessages(
    conversationId: string,
    page = 1,
    pageSize = 20,
  ) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, pausedReason: true },
    });
    if (!conversation) throw new NotFoundException('گفتگو پیدا نشد');

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = { conversationId };
    const [messages, total] = await this.prisma.$transaction([
      this.prisma.chatMessage.findMany({
        where,
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.chatMessage.count({ where }),
    ]);
    return {
      conversation,
      messages,
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async setConversationStatus(
    conversationId: string,
    status: 'ACTIVE' | 'PAUSED' | 'CLOSED',
    pausedReason?: string,
  ) {
    try {
      return await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: {
          status,
          pausedReason:
            status === 'PAUSED' ? pausedReason?.trim() || null : null,
        },
        select: { id: true, status: true, pausedReason: true, updatedAt: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') {
        throw new NotFoundException('گفتگو پیدا نشد');
      }
      throw error;
    }
  }

  async moderateMessage(
    conversationId: string,
    messageId: string,
    adminUserId: string,
    status: 'VISIBLE' | 'HIDDEN',
    note?: string,
  ) {
    const result = await this.prisma.chatMessage.updateMany({
      where: { id: messageId, conversationId },
      data: {
        status,
        moderatedById: adminUserId,
        moderationNote: note?.trim() || null,
        moderatedAt: new Date(),
      },
    });
    if (!result.count) throw new NotFoundException('پیام پیدا نشد');
    return this.prisma.chatMessage.findUniqueOrThrow({
      where: { id: messageId },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
  }

  private async getParticipantConversation(
    requestId: string,
    userId: string,
    createIfMissing: boolean,
  ) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        customerId: true,
        acceptedProviderProfileId: true,
        status: true,
      },
    });
    if (!request || !request.acceptedProviderProfileId) {
      throw new NotFoundException('متخصصی برای این درخواست انتخاب نشده است');
    }
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: request.acceptedProviderProfileId },
      select: { userId: true },
    });
    if (!provider) throw new NotFoundException('متخصص این درخواست پیدا نشد');
    if (request.customerId !== userId && provider.userId !== userId) {
      throw new ForbiddenException('به گفتگوی این درخواست دسترسی ندارید');
    }

    const conversation = createIfMissing
      ? await this.prisma.chatConversation.upsert({
          where: { serviceRequestId: requestId },
          create: { serviceRequestId: requestId },
          update: {},
          select: { id: true, status: true },
        })
      : await this.prisma.chatConversation.findUnique({
          where: { serviceRequestId: requestId },
          select: { id: true, status: true },
        });
    if (!conversation) throw new NotFoundException('گفتگو پیدا نشد');
    return {
      request: { ...request, providerUserId: provider.userId },
      conversation,
    };
  }

  private containsContactInformation(body: string): boolean {
    const normalized = body
      .toLocaleLowerCase('fa-IR')
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[\u200b-\u200f\u202a-\u202e]/g, '');
    const compact = normalized.replace(/[\s().-]/g, '');

    return (
      /(?:\+?98|0098)?0?9\d{9}/.test(compact) ||
      /0\d{9,10}/.test(compact) ||
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(normalized) ||
      /(?:https?:\/\/|www\.)\S+/i.test(normalized) ||
      /@[a-z\d_.]{3,}/i.test(normalized) ||
      /(?:تلگرام|واتساپ|اینستاگرام|ایتا|روبیکا|telegram|whatsapp|instagram)\s*[:：]?\s*[@\w.+-]*/i.test(
        normalized,
      )
    );
  }
}
