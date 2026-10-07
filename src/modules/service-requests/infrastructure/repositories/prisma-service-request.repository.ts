import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServiceRequest } from '../../domain/entities/service-request.entity';
import { ServiceRequestStatus } from '../../domain/entities/service-request-status.enum';
import { PreferredTime } from '../../domain/entities/preferred-time.enum';
import type {
  AdminServiceRequestDetails,
  AdminServiceRequestListItem,
  FindAllServiceRequestsFilter,
  ServiceRequestRepository,
} from '../../domain/repositories/service-request.repository';
import { buildPaginatedResult } from '../../../../shared/utils/paginate.util';
import { PaginatedResult } from '../../../../shared/types/paginated-result.type';

@Injectable()
export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(
    f: FindAllServiceRequestsFilter,
  ): Promise<PaginatedResult<ServiceRequest>> {
    const where = this.buildWhere(f);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          skills: true,
          images: true,
          specialty: { select: { name: true } },
        },
        orderBy: { [f.sortBy]: f.sortOrder },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    return buildPaginatedResult(
      records.map((r) => this.toDomain(r)),
      total,
    );
  }

  async findAllAdmin(
    f: FindAllServiceRequestsFilter,
  ): Promise<PaginatedResult<AdminServiceRequestListItem>> {
    const where = this.buildWhere(f);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          skills: { include: { skill: { select: { id: true, name: true } } } },
          images: true,
          specialty: { select: { name: true } },
          customer: { select: { name: true, email: true, phone: true } },
        },
        orderBy: { [f.sortBy]: f.sortOrder },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    return buildPaginatedResult(
      records.map((record) => ({
        request: this.toDomain(record),
        customer: record.customer,
        skills: record.skills.map(({ skill }) => ({
          id: skill.id,
          name: skill.name,
        })),
      })),
      total,
    );
  }

  async findAdminDetails(id: string): Promise<AdminServiceRequestDetails | null> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            _count: { select: { serviceRequests: true } },
          },
        },
        acceptedProviderProfile: {
          select: {
            rating: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        specialty: { select: { name: true } },
        skills: { include: { skill: { select: { name: true } } } },
        images: { select: { url: true, createdAt: true } },
        payments: {
          select: {
            amountToman: true,
            gateway: true,
            status: true,
            referenceId: true,
            paidAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        review: { select: { rating: true, text: true, createdAt: true } },
        invitations: { select: { status: true } },
      },
    });

    if (!request) return null;

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      status: request.status as unknown as ServiceRequestStatus,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      address: request.address,
      latitude: request.latitude,
      longitude: request.longitude,
      preferredTime: request.preferredTime as unknown as PreferredTime | null,
      scheduledAt: request.scheduledAt,
      budgetMin: request.budgetMin,
      budgetMax: request.budgetMax,
      providerPriceToman: request.providerPriceToman,
      providerPricingMode: request.providerPricingMode,
      providerHourlyRateToman: request.providerHourlyRateToman,
      providerHourlyUnitLabel: request.providerHourlyUnitLabel,
      providerEstimatedHours: request.providerEstimatedHours,
      specialty: request.specialty?.name ?? null,
      skills: request.skills.map(({ skill }) => skill.name),
      images: request.images,
      customer: request.customer
        ? {
            name: request.customer.name,
            email: request.customer.email,
            phone: request.customer.phone,
            createdAt: request.customer.createdAt,
            serviceRequestCount: request.customer._count.serviceRequests,
          }
        : null,
      provider: request.acceptedProviderProfile
        ? {
            ...request.acceptedProviderProfile.user,
            rating: request.acceptedProviderProfile.rating,
          }
        : null,
      payments: request.payments,
      review: request.review,
      dispute:
        request.disputeReason ||
        request.disputeDescription ||
        request.disputeResolution
          ? {
              reason: request.disputeReason,
              description: request.disputeDescription,
              resolution: request.disputeResolution,
              resolutionNote: request.disputeResolutionNote,
              resolvedAt: request.disputeResolvedAt,
            }
          : null,
      invitationCounts: {
        pending: request.invitations.filter(({ status }) => status === 'PENDING').length,
        accepted: request.invitations.filter(({ status }) => status === 'ACCEPTED').length,
        declined: request.invitations.filter(({ status }) => status === 'DECLINED').length,
      },
    };
  }

  async cancelOpenRequestWithoutPayments(id: string): Promise<boolean> {
    const result = await this.prisma.serviceRequest.updateMany({
      where: {
        id,
        status: 'OPEN',
        payments: { none: {} },
      },
      data: { status: 'CANCELLED' },
    });
    return result.count > 0;
  }
  async save(request: ServiceRequest): Promise<void> {
    await this.prisma.$transaction(async (db) => {
      await db.serviceRequest.create({
        data: {
          id: request.id,
          customerId: request.customerId,
          specialtyId: request.specialtyId,
          title: request.title,
          description: request.description,
          status: request.status as unknown as any,
          address: request.address,
          latitude: request.latitude,
          longitude: request.longitude,
          budgetMin: request.budgetMin,
          budgetMax: request.budgetMax,
          preferredTime: request.preferredTime as unknown as any,
          scheduledAt: request.scheduledAt,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        },
      });
      if (request.skillIds.length) {
        await db.serviceRequestSkill.createMany({
          data: request.skillIds.map((skillId) => ({
            serviceRequestId: request.id,
            skillId,
          })),
        });
      }
    });
  }

  async update(request: ServiceRequest): Promise<void> {
    await this.prisma.serviceRequest.update({
      where: { id: request.id },
      data: {
        title: request.title,
        description: request.description,
        status: request.status as unknown as any,
        address: request.address,
        latitude: request.latitude,
        longitude: request.longitude,
        budgetMin: request.budgetMin,
        budgetMax: request.budgetMax,
        preferredTime: request.preferredTime as unknown as any,
        scheduledAt: request.scheduledAt,
        updatedAt: request.updatedAt,
      },
    });

    await this.prisma.serviceRequestSkill.deleteMany({
      where: { serviceRequestId: request.id },
    });

    if (request.skillIds.length > 0) {
      await this.prisma.serviceRequestSkill.createMany({
        data: request.skillIds.map((skillId) => ({
          serviceRequestId: request.id,
          skillId,
        })),
      });
    }
  }

  async addImage(
    serviceRequestId: string,
    url: string,
    publicId: string,
  ): Promise<{ id: string; url: string }> {
    const image = await this.prisma.serviceRequestImage.create({
      data: {
        serviceRequestId,
        url,
        publicId,
      },
    });

    return { id: image.id, url: image.url };
  }

  async findById(id: string): Promise<ServiceRequest | null> {
    const record = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        skills: true,
        images: true,
        specialty: { select: { name: true } },
      },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByCustomerId(customerId: string): Promise<ServiceRequest[]> {
    const records = await this.prisma.serviceRequest.findMany({
      where: { customerId },
      include: {
        skills: true,
        images: true,
        specialty: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async findOpenBySkillIds(skillIds: string[]): Promise<ServiceRequest[]> {
    const records = await this.prisma.serviceRequest.findMany({
      where: {
        status: ServiceRequestStatus.OPEN as unknown as any,
        skills: {
          some: {
            skillId: { in: skillIds },
          },
        },
      },
      include: {
        skills: true,
        images: true,
        specialty: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  private buildWhere(f: FindAllServiceRequestsFilter) {
    const where: any = {};
    if (f.status) where.status = f.status;
    if (f.customerId) where.customerId = f.customerId;
    if (f.preferredTime) where.preferredTime = f.preferredTime;

    if (f.search) {
      where.OR = [
        { title: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
        { address: { contains: f.search, mode: 'insensitive' } },
        {
          customer: {
            is: {
              OR: [
                { name: { contains: f.search, mode: 'insensitive' } },
                { email: { contains: f.search, mode: 'insensitive' } },
                { phone: { contains: f.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (f.skillIds?.length) {
      where.skills = { some: { skillId: { in: f.skillIds } } };
    }

    const and: any[] = [];
    if (f.budgetFrom !== undefined) and.push({ budgetMax: { gte: f.budgetFrom } });
    if (f.budgetTo !== undefined) and.push({ budgetMin: { lte: f.budgetTo } });
    if (and.length) where.AND = and;

    if (f.createdFrom || f.createdTo) {
      where.createdAt = {
        ...(f.createdFrom && { gte: f.createdFrom }),
        ...(f.createdTo && { lte: f.createdTo }),
      };
    }
    if (f.updatedFrom || f.updatedTo) {
      where.updatedAt = {
        ...(f.updatedFrom && { gte: f.updatedFrom }),
        ...(f.updatedTo && { lte: f.updatedTo }),
      };
    }

    return where;
  }

  private toDomain(record: any): ServiceRequest {
    return ServiceRequest.reconstitute(
      record.id,
      record.customerId,
      record.title,
      record.description,
      record.status as ServiceRequestStatus,
      record.skills.map((s: any) => s.skillId),
      record.address,
      record.latitude,
      record.longitude,
      record.budgetMin,
      record.budgetMax,
      record.preferredTime as PreferredTime | null,
      record.images.map((img: any) => img.id),
      record.createdAt,
      record.updatedAt,
      record.scheduledAt ?? null,
      record.specialtyId ?? null,
      record.specialty?.name ?? null,
    );
  }
}
