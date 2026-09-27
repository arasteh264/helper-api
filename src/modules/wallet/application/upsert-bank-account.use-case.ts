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
    return this.upsert(
      () =>
        this.walletRepository.upsertBankAccount(userId, this.toBankData(dto)),
      dto,
    );
  }

  async executeForProviderProfile(
    providerProfileId: string,
    dto: { holderName: string; sheba: string; bankName?: string },
  ) {
    return this.upsert(
      () =>
        this.walletRepository.upsertBankAccountByProviderProfileId(
          providerProfileId,
          this.toBankData(dto),
        ),
      dto,
    );
  }

  private async upsert(
    save: () => ReturnType<WalletRepository['upsertBankAccount']>,
    dto: { holderName: string; sheba: string; bankName?: string },
  ) {
    if (!isValidSheba(dto.sheba)) {
      throw new BadRequestException('Invalid Sheba number');
    }

    const account = await save();
    if (!account) throw new NotFoundException('Provider profile not found');

    return account;
  }

  private toBankData(dto: {
    holderName: string;
    sheba: string;
    bankName?: string;
  }) {
    return {
      holderName: dto.holderName.trim(),
      sheba: dto.sheba,
      bankName: dto.bankName?.trim() || null,
    };
  }
}
