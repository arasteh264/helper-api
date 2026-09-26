import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  ProviderDocumentRecord,
  ProviderDocumentRepository,
  UpsertProviderDocumentInput,
} from '../../application/provider-document.repository';

@Injectable()
export class PrismaProviderDocumentRepository implements ProviderDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByType(
    input: UpsertProviderDocumentInput,
  ): Promise<ProviderDocumentRecord> {
    return this.prisma.providerDocument.upsert({
      where: {
        providerProfileId_type: {
          providerProfileId: input.providerProfileId,
          type: input.type as any,
        },
      },
      create: {
        providerProfileId: input.providerProfileId,
        type: input.type as any,
        url: input.url,
        publicId: input.publicId,
        status: 'PENDING',
        rejectionNote: null,
      },
      update: {
        url: input.url,
        publicId: input.publicId,
        status: 'PENDING',
        rejectionNote: null,
      },
    }) as unknown as ProviderDocumentRecord;
  }

  async findByProviderProfileId(
    providerProfileId: string,
  ): Promise<ProviderDocumentRecord[]> {
    return this.prisma.providerDocument.findMany({
      where: { providerProfileId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as ProviderDocumentRecord[];
  }

  async findById(id: string): Promise<ProviderDocumentRecord | null> {
    return this.prisma.providerDocument.findUnique({
      where: { id },
    }) as unknown as Promise<ProviderDocumentRecord | null>;
  }

  async updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionNote?: string | null,
  ): Promise<ProviderDocumentRecord> {
    return this.prisma.providerDocument.update({
      where: { id },
      data: { status: status as any, rejectionNote: rejectionNote ?? null },
    }) as unknown as ProviderDocumentRecord;
  }
}
