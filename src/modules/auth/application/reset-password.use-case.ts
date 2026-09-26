import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { PasswordHasher } from '../../users/domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../../users/domain/services/password-hasher.token';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findByResetToken(token);

    if (!user || !user.isResetTokenValid(token)) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    user.setPassword(passwordHash);
    user.clearResetToken();

    await this.userRepository.update(user);
  }
}
