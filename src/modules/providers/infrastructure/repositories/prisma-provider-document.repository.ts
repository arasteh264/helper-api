import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import {
  ProviderDocumentRecord,
  ProviderDocumentRepository,
  UpsertProviderDocumentInput,
} from '../../application/documents/provider-document.repository';

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
    adminUserId?: string,
  ): Promise<ProviderDocumentRecord> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.providerDocument.findUniqueOrThrow({
        where: { id },
        select: { status: true, rejectionNote: true },
      });
      const updated = await tx.providerDocument.update({
        where: { id },
        data: { status: status as any, rejectionNote: rejectionNote ?? null },
      });
      if (adminUserId) {
        await tx.adminAuditLog.create({
          data: {
            actorUserId: adminUserId,
            action:
              status === 'APPROVED'
                ? 'PROVIDER_DOCUMENT_APPROVED'
                : 'PROVIDER_DOCUMENT_REJECTED',
            targetType: 'PROVIDER_DOCUMENT',
            targetId: id,
            reason: rejectionNote ?? 'مدرک متخصص تأیید شد',
            beforeState: previous,
            afterState: { status, rejectionNote: rejectionNote ?? null },
          },
        });
      }
      return updated as unknown as ProviderDocumentRecord;
    });
  }
}
