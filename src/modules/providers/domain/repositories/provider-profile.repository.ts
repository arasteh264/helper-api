import {
  ProviderProfile,
  ProviderVerificationStatus,
  ProviderWorkingHourSlot,
} from '../entities/provider-profile.entity';

export interface ProviderProfileDetails {
  id: string;
  userId: string;
  bio: string | null;
  rating: number;
  isVerified: boolean;
  verificationStatus: ProviderVerificationStatus;
  verificationNote: string | null;
  verifiedAt: Date | null;
  isAvailable: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string; email: string; phone: string };
  skills: { id: string; name: string }[];
  workingHours: ProviderWorkingHourSlot[];
}


export interface ProviderProfileRepository {
  save(profile: ProviderProfile): Promise<void>;
  update(profile: ProviderProfile): Promise<void>;

  findByUserId(userId: string): Promise<ProviderProfile | null>;
  findById(id: string): Promise<ProviderProfile | null>;

  findDetailsByUserId(
    userId: string,
  ): Promise<ProviderProfileDetails | null>;

  findMatchingBySkillIds(
    skillIds: string[],
  ): Promise<ProviderProfile[]>;

  findByVerificationStatus(
    status: ProviderVerificationStatus,
  ): Promise<ProviderProfile[]>;

  findAllApproved(): Promise<ProviderProfile[]>;

findAllApprovedDetails(): Promise<ProviderProfileDetails[]>;
}
