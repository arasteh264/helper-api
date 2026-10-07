import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WALLET_REPOSITORY } from '../domain/repositories/wallet.repository.token';
import type { WalletRepository } from '../domain/repositories/wallet.repository';
import type { WalletTransactionType } from '../domain/entities/wallet-transaction-type';
import { NotificationsService } from '../../notifications/notifications.service';

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
  private readonly logger = new Logger(ReviewPayoutRequestUseCase.name);

  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepository: WalletRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(
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
    const payout = await this.walletRepository.reviewPayoutRequest({
      payoutRequestId,
      adminUserId,
      ...input,
      referenceCode: input.referenceCode?.trim(),
      rejectReason: input.rejectReason?.trim(),
    });
    if (input.decision === 'PAID' && payout.status === 'PAID') {
      const referenceCode = payout.referenceCode ?? input.referenceCode?.trim();
      if (!referenceCode) {
        this.logger.error(
          `Provider payout ${payout.id} was marked paid without a reference code`,
        );
      } else {
        try {
          await this.notifications.sendProviderPayoutCompletedEmail(
            payout.providerProfileId,
            payout.amount,
            referenceCode,
          );
        } catch (error) {
          this.logger.error(
            `Provider payout email could not be sent for payout ${payout.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }
    return payout;
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
