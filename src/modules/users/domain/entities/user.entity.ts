import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export class User {
  private constructor(
    public readonly id: string,
    private _name: string,
    public readonly email: string,
    private _phone: string,
    public readonly role: UserRole,
    private _status: UserStatus,
    private _passwordHash: string | null,
    private _googleId: string | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    name: string,
    email: string,
    phone: string,
    passwordHash: string | null,
  ): User {
    const now = new Date();

    return new User(
      crypto.randomUUID(),
      name,
      email,
      phone,
      UserRole.CUSTOMER,
      UserStatus.ACTIVE,
      passwordHash,
      null,
      now,
      now,
    );
  }

  static reconstitute(
    id: string,
    name: string,
    email: string,
    phone: string,
    role: UserRole,
    status: UserStatus,
    passwordHash: string | null,
    googleId: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(
      id, name, email, phone, role, status,
      passwordHash, googleId, createdAt, updatedAt,
    );
  }

  get name(): string { return this._name; }
  get phone(): string { return this._phone; }
  get status(): UserStatus { return this._status; }
  get passwordHash(): string | null { return this._passwordHash; }
  get googleId(): string | null { return this._googleId; }
  get updatedAt(): Date { return this._updatedAt; }

  suspend(): void {
    if (this._status === UserStatus.SUSPENDED) return;
    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._status === UserStatus.ACTIVE) return;
    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  updateProfile(name?: string, phone?: string): void {
    if (name !== undefined) {
      if (name.trim().length < 2) {
        throw new Error('Name must be at least 2 characters');
      }
      this._name = name.trim();
    }
    if (phone !== undefined) {
      this._phone = phone;
    }
    this._updatedAt = new Date();
  }

  setPassword(hash: string): void {
    this._passwordHash = hash;
    this._updatedAt = new Date();
  }
}