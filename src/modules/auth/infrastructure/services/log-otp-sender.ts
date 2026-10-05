import { Injectable, Logger } from '@nestjs/common';
import type { OtpSender } from '../../domain/services/otp-sender.port';

@Injectable()
export class LogOtpSender implements OtpSender {
  private readonly logger = new Logger(LogOtpSender.name);

  send(): Promise<void> {
    this.logger.warn('OTP delivery is disabled');
    return Promise.resolve();
  }
}
