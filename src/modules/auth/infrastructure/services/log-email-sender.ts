import { Injectable, Logger } from '@nestjs/common';
import type { EmailSender } from '../../domain/services/email-sender.port';

@Injectable()
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger(LogEmailSender.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`Email to ${to} | Subject: ${subject} | Body: ${body}`);
  }
}