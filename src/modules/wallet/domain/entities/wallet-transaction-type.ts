export const WalletTransactionType = {
  EARNING: 'EARNING',
  PAYOUT_REQUEST: 'PAYOUT_REQUEST',
  PAYOUT_REFUND: 'PAYOUT_REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');
