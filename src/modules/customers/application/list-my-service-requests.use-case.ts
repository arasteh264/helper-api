// service-requests/application/list-my-service-requests.use-case.ts
import { Injectable } from '@nestjs/common';
import type { ServiceRequestStatus } from '../../../../generated/prisma/enums';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { toCustomerView } from '../../../modules/service-requests/application/service-request-customer.view';

@Injectable()
export class ListMyServiceRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async executePage(
    userId: string,
    input: {
      page: number;
      pageSize: number;
      group: 'active' | 'completed' | 'cancelled';
    },
  ) {
    const groups: Record<
      'active' | 'completed' | 'cancelled',
      ServiceRequestStatus[]
    > = {
      active: [
        'OPEN',
        'OFFER_ACCEPTED',
        'CUSTOMER_CONFIRMATION_PENDING',
        'IN_PROGRESS',
        'AWAITING_CUSTOMER_CONFIRMATION',
        'DISPUTED',
      ],
      completed: ['COMPLETED'],
      cancelled: ['CANCELLED', 'EXPIRED'],
    };
    const groupWhere = {
      active: { status: { in: [...groups.active] } },
      completed: { status: { in: [...groups.completed] } },
      cancelled: { status: { in: [...groups.cancelled] } },
    };
    const where = {
      customerId: userId,
      ...groupWhere[input.group],
    };
    const [requests, total, activeCount, completedCount, cancelledCount] =
      await Promise.all([
        this.prisma.serviceRequest.findMany({
          where,
          include: {
            skills: { include: { skill: true } },
            specialty: { select: { name: true } },
            images: true,
            acceptedProviderProfile: {
              include: { user: { select: { name: true } } },
            },
            review: true,
            payments: {
              where: { status: 'PAID' },
              select: { id: true },
              take: 1,
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.serviceRequest.count({ where }),
        this.prisma.serviceRequest.count({
          where: {
            customerId: userId,
            ...groupWhere.active,
          },
        }),
        this.prisma.serviceRequest.count({
          where: {
            customerId: userId,
            ...groupWhere.completed,
          },
        }),
        this.prisma.serviceRequest.count({
          where: {
            customerId: userId,
            ...groupWhere.cancelled,
          },
        }),
      ]);

    return {
      items: requests.map(toCustomerView),
      total,
      page: input.page,
      pageSize: input.pageSize,
      counts: {
        active: activeCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
    };
  }
}
