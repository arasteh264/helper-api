import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ListWalletTransactionsFilter,
  WalletRepository,
} from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';

@Injectable()
export class ListWalletTransactionsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(userId: string, filter: ListWalletTransactionsFilter) {
    const wallet = await this.walletRepository.findWalletByUserId(userId);
    if (!wallet) throw new NotFoundException('Provider profile not found');

    return this.walletRepository.listTransactions(userId, filter);
  }
}
