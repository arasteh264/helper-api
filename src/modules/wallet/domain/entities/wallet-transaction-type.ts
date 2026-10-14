export const WalletTransactionType = {
  EARNING: 'EARNING',
  COMMISSION: 'COMMISSION',
  PAYOUT_REQUEST: 'PAYOUT_REQUEST',
  PAYOUT_REFUND: 'PAYOUT_REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
  STORY_PROMOTION: 'STORY_PROMOTION',
} as const;

export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');
