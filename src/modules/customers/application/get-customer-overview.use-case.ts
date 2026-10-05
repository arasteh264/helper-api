// application/get-customer-overview.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { CUSTOMER_OVERVIEW_READER } from '../domain/repositories/customer-overview.reader.token';
import type { CustomerOverviewReader } from '../domain/repositories/customer-overview.reader';
import { CUSTOMER_WALLET_REPOSITORY } from '../domain/repositories/customer-wallet.repository.token';
import type { CustomerWalletRepository } from '../domain/repositories/customer-wallet.repository';
import { GetOrCreateCustomerProfileUseCase } from './get-or-create-customer-profile.use-case';
import { ListMyServiceRequestsUseCase } from './list-my-service-requests.use-case';

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
    const [overview, wallet, requestsPage] = await Promise.all([
      this.overviewReader.read(userId),
      this.walletRepository.getOrCreate(profile.id),
      this.listMyRequests.executePage(userId, {
        page: 1,
        pageSize: 5,
        group: 'active',
      }),
    ]);

    return {
      id: profile.id,
      userId,
      name: overview.name,
      memberSince: overview.memberSince,
      walletBalance: wallet.balance,
      activeRequests: requestsPage.counts.active,
      completedJobs: requestsPage.counts.completed,
      addressesCount: overview.addressesCount,
      recentActiveRequests: requestsPage.items,
    };
  }
}
