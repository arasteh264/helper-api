import { Inject, Injectable } from '@nestjs/common';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';
import type { WalletRepository } from '../domain/repositories/wallet.repository';

@Injectable()
export class ListMyPayoutRequestsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(userId: string) {
    return this.walletRepository.listMyPayoutRequests(userId);
  }
}
