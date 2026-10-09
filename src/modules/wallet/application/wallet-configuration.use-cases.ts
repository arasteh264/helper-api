import { Inject, Injectable } from '@nestjs/common';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';

@Injectable()
export class GetWalletConfigurationUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute() {
    return this.walletRepository.getConfiguration();
  }
}

@Injectable()
export class UpdateWalletCommissionRateUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(rate: number, adminUserId: string, reason: string) {
    return this.walletRepository.updateCommissionRate(
      rate,
      adminUserId,
      reason,
    );
  }
}
