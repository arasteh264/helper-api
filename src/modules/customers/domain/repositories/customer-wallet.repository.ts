import { CustomerWallet } from '../entities/customer-wallet.entity';

export interface CustomerWalletRepository {
  getOrCreate(customerProfileId: string): Promise<CustomerWallet>;
}