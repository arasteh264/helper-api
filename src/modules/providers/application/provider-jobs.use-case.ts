import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class ProviderJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const profile = await this.getProfile(userId);
    const skillIds = profile.skills.map((skill) => skill.skillId);

    const [invitations, assigned, declinedInvitations] = await Promise.all([
      this.prisma.providerRequestInvitation.findMany({
        where: {
          providerProfileId: profile.id,
          status: 'PENDING',
          serviceRequest: { status: 'OPEN' },
        },
        include: {
          serviceRequest: {
            include: {
              skills: { include: { skill: true } },
              images: { select: { url: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceRequest.findMany({
        where: {
          acceptedProviderProfileId: profile.id,
          status: {
            in: [
              'OFFER_ACCEPTED',
              'IN_PROGRESS',
              'COMPLETED',
              'CANCELLED',
              'EXPIRED',
              'DISPUTED',
            ],
          },
        },
        include: {
          skills: { include: { skill: true } },
          images: { select: { url: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.providerRequestInvitation.findMany({
        where: { providerProfileId: profile.id, status: 'DECLINED' },
        include: {
          serviceRequest: {
            include: {
              skills: { include: { skill: true } },
              images: { select: { url: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const declinedRequests = declinedInvitations.map(
      (invitation) => invitation.serviceRequest,
    );
    const records = [
      ...invitations.map((invitation) => ({
        request: invitation.serviceRequest,
        viewStatus: 'new' as const,
      })),
      ...declinedRequests.map((request) => ({
        request,
        viewStatus: 'declined' as const,
      })),
      ...assigned.map((request) => ({
        request,
        viewStatus: this.toViewStatus(request.status),
      })),
    ];
    const customerIds = [
      ...new Set(records.map(({ request }) => request.customerId)),
    ];
    const customers = customerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const customerById = new Map(
      customers.map((customer) => [customer.id, customer]),
    );

    return records.map(({ request, viewStatus }) => {
      const customer = customerById.get(request.customerId);
      const showContact =
        viewStatus === 'accepted' || viewStatus === 'in_progress';
      return {
        id: request.id,
        title: request.title,
        service:
          request.skills.map((item) => item.skill.name).join('، ') || 'عمومی',
        customerName: customer?.name ?? 'مشتری',
        ...(showContact && customer?.phone
          ? { customerPhone: customer.phone }
          : {}),
        address: request.address ?? 'آدرس پس از هماهنگی نمایش داده می‌شود',
        scheduledAt: (request.scheduledAt ?? request.createdAt).toISOString(),
        price: request.budgetMax ?? request.budgetMin ?? 0,
        status: viewStatus,
        note: request.description,
        images: request.images.map((image) => image.url),
      };
    });
  }

  async accept(userId: string, requestId: string) {
    const profile = await this.getApprovedProfile(userId);
    if (profile.skills.length === 0) {
      throw new ConflictException(
        'برای دریافت کار، ابتدا تخصص خود را ثبت کنید',
      );
    }

    await this.prisma.$transaction(async (db) => {
      const invitation = await db.providerRequestInvitation.findUnique({
        where: {
          providerProfileId_serviceRequestId: {
            providerProfileId: profile.id,
            serviceRequestId: requestId,
          },
        },
      });
      if (!invitation || invitation.status !== 'PENDING') {
        throw new NotFoundException('دعوت همکاری در دسترس نیست');
      }

      const result = await db.serviceRequest.updateMany({
        where: {
          id: requestId,
          status: 'OPEN',
          acceptedProviderProfileId: null,
        },
        data: {
          status: 'OFFER_ACCEPTED',
          acceptedProviderProfileId: profile.id,
        },
      });
      if (result.count === 0) {
        throw new ConflictException('درخواست به متخصص دیگری واگذار شده است');
      }

      await db.providerRequestInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      await db.providerRequestInvitation.updateMany({
        where: {
          serviceRequestId: requestId,
          providerProfileId: { not: profile.id },
          status: 'PENDING',
        },
        data: { status: 'WITHDRAWN', respondedAt: new Date() },
      });
    });
    return { message: 'درخواست پذیرفته شد' };
  }

  async decline(userId: string, requestId: string) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.providerRequestInvitation.updateMany({
      where: {
        providerProfileId: profile.id,
        serviceRequestId: requestId,
        status: 'PENDING',
        serviceRequest: { status: 'OPEN' },
      },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('دعوت همکاری در دسترس نیست');
    return { message: 'درخواست رد شد' };
  }

  async start(userId: string, requestId: string) {
    return this.transitionAssignedRequest(
      userId,
      requestId,
      'OFFER_ACCEPTED',
      'IN_PROGRESS',
      'کار شروع شد',
    );
  }

  async complete(userId: string, requestId: string) {
    return this.transitionAssignedRequest(
      userId,
      requestId,
      'IN_PROGRESS',
      'COMPLETED',
      'کار تکمیل شد',
    );
  }

  private async transitionAssignedRequest(
    userId: string,
    requestId: string,
    currentStatus: 'OFFER_ACCEPTED' | 'IN_PROGRESS',
    nextStatus: 'IN_PROGRESS' | 'COMPLETED',
    message: string,
  ) {
    const profile = await this.getApprovedProfile(userId);
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        acceptedProviderProfileId: profile.id,
        status: currentStatus,
      },
      data: { status: nextStatus },
    });
    if (!result.count)
      throw new ConflictException('وضعیت این کار تغییر کرده است');
    return { message };
  }

  private async getApprovedProfile(userId: string) {
    const profile = await this.getProfile(userId);
    if (profile.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException('پس از تأیید حساب می‌توانید درخواست بگیرید');
    }
    return profile;
  }

  private async getProfile(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        verificationStatus: true,
        isAvailable: true,
        skills: { select: { skillId: true } },
      },
    });
    if (!profile) throw new NotFoundException('پروفایل متخصص پیدا نشد');
    return profile;
  }

  private toViewStatus(
    status: string,
  ): 'accepted' | 'in_progress' | 'completed' | 'cancelled' {
    switch (status) {
      case 'OFFER_ACCEPTED':
        return 'accepted';
      case 'IN_PROGRESS':
      case 'DISPUTED':
        return 'in_progress';
      case 'COMPLETED':
        return 'completed';
      default:
        return 'cancelled';
    }
  }
}
