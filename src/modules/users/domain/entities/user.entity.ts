import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export class User {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly role: UserRole,
    private _status: UserStatus,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    name: string,
    email: string,
    phone: string,
  ): User {
    const now = new Date();

    return new User(
      crypto.randomUUID(),
      name,
      email,
      phone,
      UserRole.CUSTOMER,
      UserStatus.ACTIVE,
      now,
      now,
    );
  }

  get status(): UserStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  suspend(): void {
    if (this._status === UserStatus.SUSPENDED) {
      return;
    }

    this._status = UserStatus.SUSPENDED;
    this._updatedAt = new Date();
  }

  activate(): void {
    if (this._status === UserStatus.ACTIVE) {
      return;
    }

    this._status = UserStatus.ACTIVE;
    this._updatedAt = new Date();
  }
}