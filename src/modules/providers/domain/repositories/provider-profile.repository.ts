import { ProviderProfile } from '../entities/provider-profile.entity';

export interface ProviderProfileDetails {
  id: string;
  userId: string;
  bio: string | null;
  rating: number;
  isVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string; email: string; phone: string };
  skills: { id: string; name: string }[];
}

export interface ProviderProfileRepository {
  save(profile: ProviderProfile): Promise<void>;
  update(profile: ProviderProfile): Promise<void>;
  findByUserId(userId: string): Promise<ProviderProfile | null>;
  findById(id: string): Promise<ProviderProfile | null>;
  findDetailsByUserId(userId: string): Promise<ProviderProfileDetails | null>;
}