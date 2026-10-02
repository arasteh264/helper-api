import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CustomerProfile } from '../../domain/entities/customer-profile.entity';
import type { CustomerProfileRepository } from '../../domain/repositories/customer-profile.repository';

@Injectable()
export class PrismaCustomerProfileRepository
  implements CustomerProfileRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<CustomerProfile | null> {
    const row = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    return row ? CustomerProfile.reconstitute(row) : null;
  }

  async save(profile: CustomerProfile): Promise<void> {
    await this.prisma.customerProfile.upsert({
      where: { userId: profile.userId },
      update: {},
      create: {
        id: profile.id,
        userId: profile.userId,
        createdAt: profile.createdAt,
      },
    });
  }
}