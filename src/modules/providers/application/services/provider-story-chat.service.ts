import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

const publicStoryWhere = () => ({
  status: 'APPROVED' as const,
  expiresAt: { gt: new Date() },
  OR: [{ isPaid: false }, { payments: { some: { status: 'PAID' as const } } }],
});

@Injectable()
export class ProviderStoryChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listProviderConversations(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new ForbiddenException('حساب متخصص برای این کار پیدا نشد');
    }

    const conversations = await this.prisma.providerStoryConversation.findMany({
      where: { providerProfileId: profile.id },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            mediaType: true,
            thumbnailUrl: true,
          },
        },
        customer: { select: { id: true, name: true } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { body: true, createdAt: true, senderUserId: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      story: conversation.story,
      customer: conversation.customer,
      messageCount: conversation._count.messages,
      lastMessage: conversation.messages[0] ?? null,
      updatedAt: conversation.updatedAt,
    }));
  }

  async getCustomerStoryMessages(userId: string, storyId: string) {
    const conversation = await this.getOrCreateCustomerConversation(
      userId,
      storyId,
    );
    return this.getConversationMessages(userId, conversation.id);
  }

  async getConversationMessages(userId: string, conversationId: string) {
    const conversation = await this.prisma.providerStoryConversation.findUnique(
      {
        where: { id: conversationId },
        include: {
          story: {
            select: {
              id: true,
              title: true,
              mediaType: true,
              thumbnailUrl: true,
            },
          },
          customer: { select: { id: true, name: true } },
          providerProfile: {
            select: {
              id: true,
              userId: true,
              user: { select: { name: true } },
            },
          },
          messages: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 200,
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    );
    if (!conversation) throw new NotFoundException('گفتگوی داستان پیدا نشد');
    if (
      conversation.customerUserId !== userId &&
      conversation.providerProfile.userId !== userId
    ) {
      throw new ForbiddenException('به گفتگوی این داستان دسترسی ندارید');
    }

    return {
      id: conversation.id,
      story: conversation.story,
      customer: conversation.customer,
      provider: {
        id: conversation.providerProfile.userId,
        name: conversation.providerProfile.user.name,
      },
      messages: conversation.messages,
    };
  }

  async sendCustomerStoryMessage(
    userId: string,
    storyId: string,
    body: string,
  ) {
    const conversation = await this.getOrCreateCustomerConversation(
      userId,
      storyId,
    );
    return this.sendMessage(userId, conversation.id, body);
  }

  async sendConversationMessage(
    userId: string,
    conversationId: string,
    body: string,
  ) {
    return this.sendMessage(userId, conversationId, body);
  }

  private async getOrCreateCustomerConversation(
    userId: string,
    storyId: string,
  ) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!customer) {
      throw new ForbiddenException(
        'برای پیام‌دادن باید با حساب مشتری وارد شوید',
      );
    }

    const story = await this.prisma.providerStory.findFirst({
      where: { id: storyId, ...publicStoryWhere() },
      select: { id: true, providerProfileId: true },
    });
    if (!story) {
      throw new NotFoundException('داستان منتشرشده پیدا نشد یا منقضی شده است');
    }
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: story.providerProfileId },
      select: { userId: true },
    });
    if (!provider || provider.userId === userId) {
      throw new ForbiddenException('امکان شروع گفتگو با این داستان وجود ندارد');
    }

    return this.prisma.providerStoryConversation.upsert({
      where: {
        storyId_customerUserId: { storyId, customerUserId: userId },
      },
      create: {
        storyId,
        customerUserId: userId,
        providerProfileId: story.providerProfileId,
      },
      update: {},
      select: { id: true },
    });
  }

  private async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
  ) {
    const text = body.trim();
    if (!text) throw new BadRequestException('متن پیام خالی است');
    if (text.length > 2000) {
      throw new BadRequestException('حداکثر طول پیام ۲۰۰۰ نویسه است');
    }
    if (this.containsContactInformation(text)) {
      throw new BadRequestException(
        'ارسال شماره تماس، ایمیل، لینک یا شناسه شبکه اجتماعی مجاز نیست',
      );
    }

    const conversation = await this.prisma.providerStoryConversation.findUnique(
      {
        where: { id: conversationId },
        select: {
          id: true,
          storyId: true,
          customerUserId: true,
          providerProfileId: true,
          providerProfile: { select: { userId: true } },
        },
      },
    );
    if (!conversation) throw new NotFoundException('گفتگوی داستان پیدا نشد');
    if (
      conversation.customerUserId !== userId &&
      conversation.providerProfile.userId !== userId
    ) {
      throw new ForbiddenException('اجازه‌ی ارسال پیام در این گفتگو را ندارید');
    }
    if (
      conversation.customerUserId === userId &&
      !(await this.prisma.providerStory.findFirst({
        where: { id: conversation.storyId, ...publicStoryWhere() },
        select: { id: true },
      }))
    ) {
      throw new ForbiddenException(
        'پس از پایان انتشار داستان، ارسال پیام جدید ممکن نیست',
      );
    }

    const message = await this.prisma.providerStoryMessage.create({
      data: { conversationId, senderUserId: userId, body: text },
      include: { sender: { select: { id: true, name: true } } },
    });
    await this.prisma.providerStoryConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
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
