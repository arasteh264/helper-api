import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';
import { isValidSheba } from '../domain/utils/sheba.util';

@Injectable()
export class UpsertBankAccountUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  async execute(
    userId: string,
    dto: { holderName: string; sheba: string; bankName?: string },
  ) {
    if (!isValidSheba(dto.sheba)) {
      throw new BadRequestException('Invalid Sheba number');
    }

    const account = await this.walletRepository.upsertBankAccount(userId, {
      holderName: dto.holderName.trim(),
      sheba: dto.sheba,
      bankName: dto.bankName?.trim() || null,
    });
    if (!account) throw new NotFoundException('Provider profile not found');

    return account;
  }
}
