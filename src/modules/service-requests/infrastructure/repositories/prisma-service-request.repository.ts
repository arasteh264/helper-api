import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ServiceRequest } from '../../domain/entities/service-request.entity';
import { ServiceRequestStatus } from '../../domain/entities/service-request-status.enum';
import { PreferredTime } from '../../domain/entities/preferred-time.enum';
import type {
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
    const where: any = {};

    if (f.status) where.status = f.status as unknown as any;
    if (f.customerId) where.customerId = f.customerId;
    if (f.preferredTime)
      where.preferredTime = f.preferredTime as unknown as any;

    if (f.search) {
      where.OR = [
        { title: { contains: f.search, mode: 'insensitive' } },
        { description: { contains: f.search, mode: 'insensitive' } },
        { address: { contains: f.search, mode: 'insensitive' } },
      ];
    }

    if (f.skillIds?.length) {
      where.skills = { some: { skillId: { in: f.skillIds } } };
    }

    const and: any[] = [];
    if (f.budgetFrom !== undefined)
      and.push({ budgetMax: { gte: f.budgetFrom } });
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

    const [records, total] = await this.prisma.$transaction([
      this.prisma.serviceRequest.findMany({
        where,
        include: { skills: true, images: true },
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
  async save(request: ServiceRequest): Promise<void> {
    await this.prisma.serviceRequest.create({
      data: {
        id: request.id,
        customerId: request.customerId,
        title: request.title,
        description: request.description,
        status: request.status as unknown as any,
        address: request.address,
        latitude: request.latitude,
        longitude: request.longitude,
        budgetMin: request.budgetMin,
        budgetMax: request.budgetMax,
        preferredTime: request.preferredTime as unknown as any,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
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
      include: { skills: true, images: true },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByCustomerId(customerId: string): Promise<ServiceRequest[]> {
    const records = await this.prisma.serviceRequest.findMany({
      where: { customerId },
      include: { skills: true, images: true },
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
      include: { skills: true, images: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
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
    );
  }
}
