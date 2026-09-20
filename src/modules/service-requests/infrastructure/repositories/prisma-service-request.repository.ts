import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ServiceRequest } from '../../domain/entities/service-request.entity';
import { ServiceRequestStatus } from '../../domain/entities/service-request-status.enum';
import { PreferredTime } from '../../domain/entities/preferred-time.enum';
import type { ServiceRequestRepository } from '../../domain/repositories/service-request.repository';

@Injectable()
export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

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