export class ProviderProfile {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    private _bio: string | null,
    private _rating: number,
    private _isVerified: boolean,
    private _skillIds: string[],
    public readonly createdAt: Date,
    private _updatedAt: Date,
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
  ): ProviderProfile {
    return new ProviderProfile(
      id, userId, bio, rating, isVerified, skillIds, createdAt, updatedAt,
    );
  }

  get bio(): string | null { return this._bio; }
  get rating(): number { return this._rating; }
  get isVerified(): boolean { return this._isVerified; }
  get skillIds(): string[] { return this._skillIds; }
  get updatedAt(): Date { return this._updatedAt; }

  updateBio(bio: string): void {
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

  verify(): void {
    this._isVerified = true;
    this._updatedAt = new Date();
  }
}