import type { PaginatedResult } from '../../../../shared/types/paginated-result.type';
import type { WalletTransactionType } from '../entities/wallet-transaction-type';

export interface WalletSummary {
  id: string;
  balance: number;
  totalEarned: number;
  totalNetEarned: number;
  totalWithdrawn: number;
  totalCommission: number;
  currentMonthEarned: number;
  currentMonthNetEarned: number;
  currentMonthCommission: number;
  pendingPayouts: number;
  commissionRate: number;
  minWithdrawal: number;
  monthly: { label: string; amount: number }[];
}

export interface WalletTransactionView {
  id: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  description: string | null;
  serviceRequestId: string | null;
  payoutRequestId: string | null;
  createdAt: Date;
  payoutStatus: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED' | null;
}

export interface BankAccountView {
  holderName: string;
  sheba: string;
  bankName: string | null;
  updatedAt: Date;
}

export interface ListWalletTransactionsFilter {
  page: number;
  pageSize: number;
  search?: string;
  type?: WalletTransactionType;
  direction?: 'in' | 'out';
  createdFrom?: Date;
  createdTo?: Date;
  sortOrder: 'asc' | 'desc';
}

export interface CreditWalletInput {
  providerProfileId: string;
  amount: number;
  type: 'EARNING' | 'ADJUSTMENT';
  adminUserId?: string;
  description?: string;
  serviceRequestId?: string;
}

export interface PayoutRequestView {
  id: string;
  providerProfileId: string;
  providerName: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';
  holderName: string;
  sheba: string;
  bankName: string | null;
  referenceCode: string | null;
  rejectReason: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface PayoutReviewInput {
  payoutRequestId: string;
  adminUserId: string;
  decision: 'PAID' | 'REJECTED';
  referenceCode?: string;
  rejectReason?: string;
}

export interface PlatformWalletTransactionView extends WalletTransactionView {
  providerProfileId: string;
  providerName: string;
}

export interface PlatformAccountingSummary {
  allTimePaidVolumeToman: number;
  currentMonthPaidVolumeToman: number;
  allTimePlatformCommissionToman: number;
  currentMonthPlatformCommissionToman: number;
  providerGrossEarningsToman: number;
  currentMonthProviderGrossEarningsToman: number;
  providerAvailableBalanceToman: number;
  providerFundsHeldToman: number;
  pendingPayoutAmountToman: number;
  pendingPayoutCount: number;
  totalPaidOutToman: number;
  currentMonthPaidOutToman: number;
}

export type CreditResult =
  | { status: 'CREDITED'; transaction: WalletTransactionView }
  | { status: 'DUPLICATE' }
  | { status: 'PROVIDER_NOT_FOUND' };

export interface WalletRepository {
  findWalletByUserId(userId: string): Promise<WalletSummary | null>;

  listTransactions(
    userId: string,
    filter: ListWalletTransactionsFilter,
  ): Promise<PaginatedResult<WalletTransactionView>>;

  credit(input: CreditWalletInput): Promise<CreditResult>;

  findBankAccountByUserId(userId: string): Promise<BankAccountView | null>;

  upsertBankAccount(
    userId: string,
    data: { holderName: string; sheba: string; bankName: string | null },
  ): Promise<BankAccountView | null>;

  findBankAccountByProviderProfileId(
    providerProfileId: string,
  ): Promise<BankAccountView | null>;

  upsertBankAccountByProviderProfileId(
    providerProfileId: string,
    data: { holderName: string; sheba: string; bankName: string | null },
  ): Promise<BankAccountView | null>;

  getConfiguration(): Promise<{
    commissionRate: number;
    minWithdrawal: number;
  }>;

  updateCommissionRate(
    rate: number,
    adminUserId: string,
    reason: string,
  ): Promise<{ commissionRate: number; minWithdrawal: number }>;

  createPayoutRequest(
    userId: string,
    amount: number,
  ): Promise<{
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;

  listPayoutRequests(
    page: number,
    pageSize: number,
    status?: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED',
  ): Promise<{
    items: PayoutRequestView[];
    page: number;
    pageSize: number;
    total: number;
  }>;
  listMyPayoutRequests(userId: string): Promise<PayoutRequestView[]>;
  reviewPayoutRequest(input: PayoutReviewInput): Promise<PayoutRequestView>;
  getPlatformAccountingSummary(): Promise<PlatformAccountingSummary>;
  listPlatformTransactions(
    page: number,
    pageSize: number,
    filter: {
      type?: WalletTransactionType;
      direction?: 'in' | 'out';
      createdFrom?: Date;
      createdTo?: Date;
    },
  ): Promise<PaginatedResult<PlatformWalletTransactionView>>;
}
