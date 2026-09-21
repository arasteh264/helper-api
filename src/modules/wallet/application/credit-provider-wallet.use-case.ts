import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreditResult,
  CreditWalletInput,
  WalletRepository,
} from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';

@Injectable()
export class CreditProviderWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(input: CreditWalletInput): Promise<CreditResult> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    const result = await this.walletRepository.credit(input);
    if (result.status === 'PROVIDER_NOT_FOUND') {
      throw new NotFoundException('Provider profile not found');
    }
    return result;
  }
}