import {
  ProviderProfile,
  ProviderAddressType,
  ProviderVerificationStatus,
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
  serviceAreaLatitude: number | null;
  serviceAreaLongitude: number | null;
  serviceAreaRadiusKm: number;
  providerAddress: string | null;
  providerAddressType: ProviderAddressType;
  createdAt: Date;
  updatedAt: Date;
  user: {
    name: string;
    email: string;
    phone: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  };
  skills: { id: string; name: string }[];
  specialties: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    groupId: string;
    groupName: string;
  }[];
}

export interface AdminProviderInsights {
  registrationDates: Date[];
  topRated: {
    id: string;
    name: string;
    rating: number;
    skills: string[];
  }[];
  topCompletedJobs: {
    id: string;
    name: string;
    completedJobs: number;
  }[];
}

export interface ProviderProfileRepository {
  save(profile: ProviderProfile): Promise<void>;
  update(
    profile: ProviderProfile,
    audit?: {
      actorUserId: string;
      action: string;
      reason: string;
      beforeState: Record<string, string | number | boolean | null>;
      afterState: Record<string, string | number | boolean | null>;
    },
  ): Promise<void>;

  findByUserId(userId: string): Promise<ProviderProfile | null>;
  findById(id: string): Promise<ProviderProfile | null>;

  findDetailsByUserId(userId: string): Promise<ProviderProfileDetails | null>;

  findActiveSpecialtyIds(specialtyIds: string[]): Promise<string[]>;
  replaceSpecialties(
    providerProfileId: string,
    specialtyIds: string[],
  ): Promise<void>;

  findMatchingBySkillIds(skillIds: string[]): Promise<ProviderProfile[]>;

  findByVerificationStatus(
    status: ProviderVerificationStatus,
  ): Promise<ProviderProfile[]>;

  findPendingDetailsPage(input: {
    skip: number;
    take: number;
    search?: string;
    isAvailable?: boolean;
    status?: ProviderVerificationStatus;
  }): Promise<{ items: ProviderProfileDetails[]; total: number }>;

  findAllApproved(): Promise<ProviderProfile[]>;

  findAllApprovedDetails(): Promise<ProviderProfileDetails[]>;

  getAdminInsights(input: {
    createdFrom: Date;
    createdTo: Date;
    limit: number;
  }): Promise<AdminProviderInsights>;
}
