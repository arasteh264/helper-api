import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';

@Injectable()
export class CreatePayoutRequestUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(userId: string, amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    return this.walletRepository.createPayoutRequest(userId, amount);
  }
}
