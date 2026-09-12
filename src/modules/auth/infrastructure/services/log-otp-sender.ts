import { Injectable, Logger } from '@nestjs/common';
import type { OtpSender } from '../../domain/services/otp-sender.port';

@Injectable()
export class LogOtpSender implements OtpSender {
  private readonly logger = new Logger(LogOtpSender.name);

  async send(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`);
  }
}