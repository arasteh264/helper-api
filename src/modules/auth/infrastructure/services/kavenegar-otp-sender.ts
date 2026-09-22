import { Injectable } from '@nestjs/common';
import type { OtpSender } from '../../domain/services/otp-sender.port';
import { SmsService } from '../../../sms/sms.service';

@Injectable()
export class KavenegarOtpSender implements OtpSender {
  constructor(private readonly smsService: SmsService) {}

  async send(phone: string, code: string): Promise<void> {
    await this.smsService.sendOtp(phone, code);
  }
}
