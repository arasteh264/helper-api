import { CustomerProfile } from '../entities/customer-profile.entity';

export interface CustomerProfileRepository {
  findByUserId(userId: string): Promise<CustomerProfile | null>;
  save(profile: CustomerProfile): Promise<void>;
}