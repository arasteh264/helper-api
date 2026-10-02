// service-requests/application/list-my-service-requests.use-case.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { toCustomerView } from '../../../modules/service-requests/application/service-request-customer.view';

@Injectable()
export class ListMyServiceRequestsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string) {
    const requests = await this.prisma.serviceRequest.findMany({
      where: { customerId: userId },
      include: {
        skills: { include: { skill: true } },
        images: true,
        acceptedProviderProfile: {
          include: { user: { select: { name: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(toCustomerView);
  }
}