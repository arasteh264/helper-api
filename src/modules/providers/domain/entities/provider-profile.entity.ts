export type ProviderVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProviderAddressType = 'HOME' | 'BUSINESS';

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
    private readonly _createdAt: Date,
    private _updatedAt: Date,
    private _avatarUrl: string | null,
    private _avatarPublicId: string | null,
    private _serviceAreaLatitude: number | null,
    private _serviceAreaLongitude: number | null,
    private _serviceAreaRadiusKm: number,
    private _providerAddress: string | null,
    private _providerAddressType: ProviderAddressType,
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
      now,
      now,
      null,
      null,
      null,
      null,
      10,
      null,
      'HOME',
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
    createdAt: Date,
    updatedAt: Date,
    avatarUrl: string | null = null,
    avatarPublicId: string | null = null,
    serviceAreaLatitude: number | null = null,
    serviceAreaLongitude: number | null = null,
    serviceAreaRadiusKm = 10,
    providerAddress: string | null = null,
    providerAddressType: ProviderAddressType = 'HOME',
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
      createdAt,
      updatedAt,
      avatarUrl,
      avatarPublicId,
      serviceAreaLatitude,
      serviceAreaLongitude,
      serviceAreaRadiusKm,
      providerAddress,
      providerAddressType,
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
  get serviceAreaLatitude(): number | null {
    return this._serviceAreaLatitude;
  }
  get serviceAreaLongitude(): number | null {
    return this._serviceAreaLongitude;
  }
  get serviceAreaRadiusKm(): number {
    return this._serviceAreaRadiusKm;
  }
  get providerAddress(): string | null {
    return this._providerAddress;
  }
  get providerAddressType(): ProviderAddressType {
    return this._providerAddressType;
  }

  updateBio(bio: string | null): void {
    this._bio = bio;
    this._updatedAt = new Date();
  }

  setAvailability(isAvailable: boolean): void {
    this._isAvailable = isAvailable;
    this._updatedAt = new Date();
  }

  setServiceArea(
    latitude: number | null,
    longitude: number | null,
    radiusKm: number,
  ): void {
    this._serviceAreaLatitude = latitude;
    this._serviceAreaLongitude = longitude;
    this._serviceAreaRadiusKm = radiusKm;
    this._updatedAt = new Date();
  }

  setProviderAddress(
    address: string | null,
    addressType: ProviderAddressType,
  ): void {
    this._providerAddress = address;
    this._providerAddressType = addressType;
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
