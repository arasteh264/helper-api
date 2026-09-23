export type ProviderVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProviderWorkingHourSlot {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

export class ProviderProfile {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private _bio: string | null,
    private _rating: number,
    private _isVerified: boolean,
    private _verificationStatus: ProviderVerificationStatus,
    private _verificationNote: string | null,
    private _verifiedAt: Date | null,
    private _isAvailable: boolean,
    private _skillIds: string[],
    private _workingHours: ProviderWorkingHourSlot[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _avatarUrl: string | null,
    private _avatarPublicId: string | null,
  ) {}

  static create(userId: string, bio: string | null): ProviderProfile {
    const now = new Date();

    return new ProviderProfile(
      crypto.randomUUID(),
      userId,
      bio,
      0,
      false,
      'PENDING',
      null,
      null,
      false,
      [],
      [],
      now,
      now,
      null,
      null,
    );
  }

  static reconstitute(
    id: string,
    userId: string,
    bio: string | null,
    rating: number,
    isVerified: boolean,
    verificationStatus: ProviderVerificationStatus,
    verificationNote: string | null,
    verifiedAt: Date | null,
    isAvailable: boolean,
    skillIds: string[],
    workingHours: ProviderWorkingHourSlot[],
    createdAt: Date,
    updatedAt: Date,
    avatarUrl: string | null = null,
    avatarPublicId: string | null = null,
  ): ProviderProfile {
    return new ProviderProfile(
      id,
      userId,
      bio,
      rating,
      isVerified,
      verificationStatus,
      verificationNote,
      verifiedAt,
      isAvailable,
      skillIds,
      workingHours,
      createdAt,
      updatedAt,
      avatarUrl,
      avatarPublicId,
    );
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get bio(): string | null {
    return this._bio;
  }
  get rating(): number {
    return this._rating;
  }
  get isVerified(): boolean {
    return this._isVerified;
  }
  get verificationStatus(): ProviderVerificationStatus {
    return this._verificationStatus;
  }
  get verificationNote(): string | null {
    return this._verificationNote;
  }
  get verifiedAt(): Date | null {
    return this._verifiedAt;
  }
  get isAvailable(): boolean {
    return this._isAvailable;
  }
  get skillIds(): string[] {
    return this._skillIds;
  }
  get workingHours(): ProviderWorkingHourSlot[] {
    return this._workingHours;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get avatarUrl(): string | null {
    return this._avatarUrl;
  }
  get avatarPublicId(): string | null {
    return this._avatarPublicId;
  }

  updateBio(bio: string | null): void {
    this._bio = bio;
    this._updatedAt = new Date();
  }

  setAvailability(isAvailable: boolean): void {
    this._isAvailable = isAvailable;
    this._updatedAt = new Date();
  }

  setWorkingHours(hours: ProviderWorkingHourSlot[]): void {
    this._workingHours = hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isActive: h.isActive,
      startTime: h.startTime,
      endTime: h.endTime,
    }));
    this._updatedAt = new Date();
  }

  addSkill(skillId: string): void {
    if (this._skillIds.includes(skillId)) {
      return;
    }
    this._skillIds.push(skillId);
    this._updatedAt = new Date();
  }

  removeSkill(skillId: string): void {
    this._skillIds = this._skillIds.filter((id) => id !== skillId);
    this._updatedAt = new Date();
  }

  changeAvatar(url: string, publicId: string): void {
    this._avatarUrl = url;
    this._avatarPublicId = publicId;
    this._updatedAt = new Date();
  }

  removeAvatar(): void {
    this._avatarUrl = null;
    this._avatarPublicId = null;
    this._updatedAt = new Date();
  }

  reviewDecision(
    status: Exclude<ProviderVerificationStatus, 'PENDING'>,
    note?: string,
  ): void {
    this._verificationStatus = status;
    this._verificationNote = note ?? null;
    this._isVerified = status === 'APPROVED';
    this._verifiedAt = status === 'APPROVED' ? new Date() : null;
    this._updatedAt = new Date();
  }

  verify(): void {
    this._verificationStatus = 'APPROVED';
    this._verificationNote = null;
    this._isVerified = true;
    this._verifiedAt = new Date();
    this._updatedAt = new Date();
  }
}
