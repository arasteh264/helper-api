export class ProviderProfile {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private _bio: string | null,
    private _rating: number,
    private _isVerified: boolean,
    private _skillIds: string[],
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
      [],
      now,
      now,
      null, // avatarUrl
      null, // avatarPublicId
    );
  }

  static reconstitute(
    id: string,
    userId: string,
    bio: string | null,
    rating: number,
    isVerified: boolean,
    skillIds: string[],
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
      skillIds,
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

  updateBio(bio: string | null): void {
    this._bio = bio;
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

  verify(): void {
    this._isVerified = true;
    this._updatedAt = new Date();
  }
}
