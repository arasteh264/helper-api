import { Inject, Injectable } from '@nestjs/common';
import type { EmailSender } from '../../domain/services/email-sender.port';
import { EMAIL_SENDER } from '../../domain/services/email-sender.token';
import type { OtpSender } from '../../domain/services/otp-sender.port';
import { buildOtpEmail } from '../templates/otp-email.template';

@Injectable()
export class EmailOtpSender implements OtpSender {
  constructor(
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  send(email: string, code: string, expiresInSeconds = 120): Promise<void> {
    return this.emailSender.send(
      email,
      'Your Helper verification code',
      buildOtpEmail(code, expiresInSeconds),
    );
  }
}
