import { ProviderProfile } from '../entities/provider-profile.entity';

export interface ProviderProfileRepository {
  save(profile: ProviderProfile): Promise<void>;
  update(profile: ProviderProfile): Promise<void>;
  findByUserId(userId: string): Promise<ProviderProfile | null>;
  findById(id: string): Promise<ProviderProfile | null>;
}