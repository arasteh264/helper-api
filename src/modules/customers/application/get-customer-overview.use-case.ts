// application/get-customer-overview.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CUSTOMER_OVERVIEW_READER } from '../domain/repositories/customer-overview.reader.token';
import type { CustomerOverviewReader } from '../domain/repositories/customer-overview.reader';
import { CUSTOMER_WALLET_REPOSITORY } from '../domain/repositories/customer-wallet.repository.token';
import type { CustomerWalletRepository } from '../domain/repositories/customer-wallet.repository';
import { GetOrCreateCustomerProfileUseCase } from './get-or-create-customer-profile.use-case';
import { ListMyServiceRequestsUseCase } from './list-my-service-requests.use-case';

const FINISHED_STATUSES = ['completed', 'cancelled'];

@Injectable()
export class GetCustomerOverviewUseCase {
  constructor(
    private readonly getOrCreateProfile: GetOrCreateCustomerProfileUseCase,
    @Inject(CUSTOMER_OVERVIEW_READER)
    private readonly overviewReader: CustomerOverviewReader,
    @Inject(CUSTOMER_WALLET_REPOSITORY)
    private readonly walletRepository: CustomerWalletRepository,
    private readonly listMyRequests: ListMyServiceRequestsUseCase,
  ) {}

  async execute(userId: string) {
    const profile = await this.getOrCreateProfile.execute(userId);
    const [overview, wallet, requests] = await Promise.all([
      this.overviewReader.read(userId),
      this.walletRepository.getOrCreate(profile.id),
      this.listMyRequests.execute(userId),
    ]);

    const active = requests.filter((r) => !FINISHED_STATUSES.includes(r.status));
    const completed = requests.filter((r) => r.status === 'completed');

    return {
      id: profile.id,
      userId,
      name: overview.name,
      memberSince: overview.memberSince,
      walletBalance: wallet.balance,
      activeRequests: active.length,
      completedJobs: completed.length,
      addressesCount: overview.addressesCount,
      recentActiveRequests: active.slice(0, 5),
    };
  }
}