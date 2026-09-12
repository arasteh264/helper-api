import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { EmailSender } from '../domain/services/email-sender.port';
import { EMAIL_SENDER } from '../domain/services/email-sender.token';
import { buildPasswordResetEmail } from '../infrastructure/templates/password-reset-email.template';

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    user.setResetToken(resetToken, resetTokenExpiry);
    await this.userRepository.update(user);

    const resetLink = `${process.env.PASSWORD_RESET_URL}?token=${resetToken}`;
    const htmlBody = buildPasswordResetEmail(resetLink);

    await this.emailSender.send(email, 'Reset your password', htmlBody);
  }
}