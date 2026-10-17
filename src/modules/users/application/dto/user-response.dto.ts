import { User } from '../../domain/entities/user.entity';

export class UserResponseDto {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string | null,
    public readonly phone: string,
    public readonly role: string,
    public readonly status: string,
    public readonly createdAt: Date,
  ) {}

  static fromEntity(user: User): UserResponseDto {
    return new UserResponseDto(
      user.id,
      user.name,
      user.email.endsWith('@placeholder.local') ? null : user.email,
      user.phone,
      user.role,
      user.status,
      user.createdAt,
    );
  }
}
