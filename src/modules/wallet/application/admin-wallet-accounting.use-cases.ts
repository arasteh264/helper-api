import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import type { WalletTransactionType } from '../domain/entities/wallet-transaction-type';

@Injectable()
export class GetPlatformAccountingSummaryUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute() {
    return this.walletRepository.getPlatformAccountingSummary();
  }
}

@Injectable()
export class ListPayoutRequestsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(
    page: number,
    pageSize: number,
    status?: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED',
  ) {
    return this.walletRepository.listPayoutRequests(page, pageSize, status);
  }
}

@Injectable()
export class ReviewPayoutRequestUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(
    payoutRequestId: string,
    adminUserId: string,
    input: {
      decision: 'PAID' | 'REJECTED';
      referenceCode?: string;
      rejectReason?: string;
    },
  ) {
    if (input.decision === 'PAID' && !input.referenceCode?.trim()) {
      throw new BadRequestException('کد پیگیری واریز الزامی است');
    }
    if (input.decision === 'REJECTED' && !input.rejectReason?.trim()) {
      throw new BadRequestException('دلیل رد درخواست برداشت الزامی است');
    }
    return this.walletRepository.reviewPayoutRequest({
      payoutRequestId,
      adminUserId,
      ...input,
      referenceCode: input.referenceCode?.trim(),
      rejectReason: input.rejectReason?.trim(),
    });
  }
}

@Injectable()
export class ListPlatformWalletTransactionsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(
    page: number,
    pageSize: number,
    filter: {
      type?: WalletTransactionType;
      direction?: 'in' | 'out';
      createdFrom?: Date;
      createdTo?: Date;
    },
  ) {
    return this.walletRepository.listPlatformTransactions(
      page,
      pageSize,
      filter,
    );
  }
}
