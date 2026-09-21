import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';

@Injectable()
export class GetBankAccountUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(userId: string) {
    const account = await this.walletRepository.findBankAccountByUserId(userId);
    if (!account) throw new NotFoundException('Bank account not set');
    return account;
  }
}