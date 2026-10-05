// infrastructure/prisma-matching.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  MatchingCriteria,
  MatchingRepository,
  PendingNotification,
  ProviderCandidate,
} from '../domain/matching.repository';

@Injectable()
export class PrismaMatchingRepository implements MatchingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getCriteria(requestId: string): Promise<MatchingCriteria | null> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { skills: { select: { skillId: true } } },
    });
    if (
      !request ||
      request.status !== 'OPEN' ||
      request.latitude === null ||
      request.longitude === null ||
      (!request.specialtyId && request.skills.length === 0)
    ) {
      return null;
    }
    return {
      requestId: request.id,
      specialtyId: request.specialtyId,
      skillIds: request.skills.map((s) => s.skillId),
      latitude: request.latitude,
      longitude: request.longitude,
    };
  }

  async findCandidates(
    requestId: string,
    specialtyId: string | null,
    skillIds: string[],
  ): Promise<ProviderCandidate[]> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { customerId: true },
    });
    if (!request) return [];

    const providers = await this.prisma.providerProfile.findMany({
      where: {
        verificationStatus: 'APPROVED',
        isAvailable: true,
        userId: { not: request.customerId },
        serviceAreaLatitude: { not: null },
        serviceAreaLongitude: { not: null },
        OR: [
          ...(specialtyId ? [{ specialties: { some: { specialtyId } } }] : []),
          ...(skillIds.length
            ? [{ skills: { some: { skillId: { in: skillIds } } } }]
            : []),
        ],
        requestDeclines: { none: { serviceRequestId: requestId } },
      },
      select: {
        id: true,
        serviceAreaLatitude: true,
        serviceAreaLongitude: true,
      },
    });
    return providers.map((p) => ({
      providerProfileId: p.id,
      latitude: p.serviceAreaLatitude!,
      longitude: p.serviceAreaLongitude!,
    }));
  }

  async createInvitations(
    requestId: string,
    items: { providerProfileId: string; distanceKm: number }[],
  ): Promise<void> {
    if (!items.length) return;
    await this.prisma.providerRequestInvitation.createMany({
      data: items.map((i) => ({
        serviceRequestId: requestId,
        providerProfileId: i.providerProfileId,
        distanceKm: i.distanceKm,
      })),
      skipDuplicates: true,
    });
  }

  async findUnnotified(requestId: string): Promise<PendingNotification[]> {
    const rows = await this.prisma.providerRequestInvitation.findMany({
      where: {
        serviceRequestId: requestId,
        status: 'PENDING',
        notifiedAt: null,
      },
      include: {
        providerProfile: { select: { userId: true } },
        serviceRequest: { select: { id: true, title: true } },
      },
    });
    return rows.map((r) => ({
      invitationId: r.id,
      providerUserId: r.providerProfile.userId,
      distanceKm: r.distanceKm,
      requestTitle: r.serviceRequest.title,
      requestId: r.serviceRequest.id,
    }));
  }

  async markNotified(invitationId: string): Promise<void> {
    await this.prisma.providerRequestInvitation.update({
      where: { id: invitationId },
      data: { notifiedAt: new Date() },
    });
  }
}
