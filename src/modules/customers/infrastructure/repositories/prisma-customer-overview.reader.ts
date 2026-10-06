// infrastructure/repositories/prisma-customer-overview.reader.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  CustomerOverviewData,
  CustomerOverviewReader,
} from '../../domain/repositories/customer-overview.reader';

@Injectable()
export class PrismaCustomerOverviewReader implements CustomerOverviewReader {
  constructor(private readonly prisma: PrismaService) {}

  async read(userId: string): Promise<CustomerOverviewData> {
    const [user, activeRequests, completedJobs, addresses] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, createdAt: true },
      }),
      this.prisma.serviceRequest.count({
        where: {
          customerId: userId,
          status: { in: ['OPEN', 'OFFER_ACCEPTED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.serviceRequest.count({
        where: { customerId: userId, status: 'COMPLETED' },
      }),
      this.prisma.customerAddress.count({ where: { customerId: userId } }),
    ]);

    return {
      name: user.name,
      memberSince: user.createdAt,
      activeRequests,
      completedJobs,
      addressesCount: addresses,
    };
  }
}
