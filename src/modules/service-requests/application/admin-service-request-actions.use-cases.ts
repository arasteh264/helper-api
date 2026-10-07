import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SERVICE_REQUEST_REPOSITORY } from '../domain/repositories/service-request.repository.token';
import type { ServiceRequestRepository } from '../domain/repositories/service-request.repository';

@Injectable()
export class AdminServiceRequestActionsUseCases {
  constructor(
    @Inject(SERVICE_REQUEST_REPOSITORY)
    private readonly repository: ServiceRequestRepository,
  ) {}

  async getDetails(id: string) {
    const details = await this.repository.findAdminDetails(id);
    if (!details) throw new NotFoundException('درخواست سرویس پیدا نشد.');
    return details;
  }

  async cancelIncomplete(id: string) {
    const cancelled = await this.repository.cancelOpenRequestWithoutPayments(id);
    if (cancelled) return { status: 'CANCELLED' as const };

    const details = await this.repository.findAdminDetails(id);
    if (!details) throw new NotFoundException('درخواست سرویس پیدا نشد.');
    throw new ConflictException(
      'فقط درخواست باز و بدون پرداخت را می‌توان از فهرست فعال خارج کرد. درخواست دارای پرداخت یا در حال انجام باید از مسیر مالی/اختلاف پیگیری شود.',
    );
  }
}
