import type { PaginatedResult } from '@/shared/types/paginated-result.type';
import type { WalletTransactionType } from '../entities/wallet-transaction-type';

export interface WalletSummary {
  id: string;
  balance: number;          
  totalEarned: number;
  totalWithdrawn: number;
  pendingPayouts: number;   
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
  description?: string;
  serviceRequestId?: string;
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
}