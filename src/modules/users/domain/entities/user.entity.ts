import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export class User {
  private constructor(
    public readonly id: string,
    private _name: string,
    private _email: string,
    private _phone: string,
    private _role: UserRole,
    private _status: UserStatus,
    private _passwordHash: string | null,
    private _googleId: string | null,
    private _otpCode: string | null,
    private _otpExpiresAt: Date | null,
    private _resetToken: string | null,
    private _resetTokenExpiry: Date | null,
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
      null,
      null,
      null,
      null,
      now,
      now,
    );
  }

  static createUnverified(
    name: string,
    email: string,
    phone: string,
    passwordHash: string | null,
    otpCode: string,
    otpExpiresAt: Date,
  ): User {
    const now = new Date();

    return new User(
      crypto.randomUUID(),
      name,
      email,
      phone,
      UserRole.CUSTOMER,
      UserStatus.INACTIVE,
      passwordHash,
      null,
      otpCode,
      otpExpiresAt,
      null,
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
    otpCode: string | null,
    otpExpiresAt: Date | null,
    resetToken: string | null,
    resetTokenExpiry: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ): User {
    return new User(
      id,
      name,
      email,
      phone,
      role,
      status,
      passwordHash,
      googleId,
      otpCode,
      otpExpiresAt,
      resetToken,
      resetTokenExpiry,
      createdAt,
      updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }
  get phone(): string {
    return this._phone;
  }
  get status(): UserStatus {
    return this._status;
  }
  get passwordHash(): string | null {
    return this._passwordHash;
  }
  get googleId(): string | null {
    return this._googleId;
  }
  get otpCode(): string | null {
    return this._otpCode;
  }
  get otpExpiresAt(): Date | null {
    return this._otpExpiresAt;
  }
  get resetToken(): string | null {
    return this._resetToken;
  }
  get resetTokenExpiry(): Date | null {
    return this._resetTokenExpiry;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get email(): string {
    return this._email;
  }
  get role(): UserRole {
    return this._role;
  }

  setRole(role: UserRole): void {
    this._role = role;
    this._updatedAt = new Date();
  }
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
  changeEmail(newEmail: string): void {
    if (!newEmail.includes('@')) {
      throw new Error('Invalid email format');
    }
    this._email = newEmail;
    this._updatedAt = new Date();
  }
  setPassword(hash: string): void {
    this._passwordHash = hash;
    this._updatedAt = new Date();
  }

  setOtp(code: string, expiresAt: Date): void {
    this._otpCode = code;
    this._otpExpiresAt = expiresAt;
    this._updatedAt = new Date();
  }

  clearOtp(): void {
    this._otpCode = null;
    this._otpExpiresAt = null;
    this._updatedAt = new Date();
  }

  isOtpValid(code: string): boolean {
    if (!this._otpCode || !this._otpExpiresAt) {
      return false;
    }
    if (this._otpCode !== code) {
      return false;
    }
    return this._otpExpiresAt.getTime() > Date.now();
  }
  setResetToken(token: string, expiresAt: Date): void {
    this._resetToken = token;
    this._resetTokenExpiry = expiresAt;
    this._updatedAt = new Date();
  }

  clearResetToken(): void {
    this._resetToken = null;
    this._resetTokenExpiry = null;
    this._updatedAt = new Date();
  }

  isResetTokenValid(token: string): boolean {
    if (!this._resetToken || !this._resetTokenExpiry) {
      return false;
    }
    if (this._resetToken !== token) {
      return false;
    }
    return this._resetTokenExpiry.getTime() > Date.now();
  }
}
