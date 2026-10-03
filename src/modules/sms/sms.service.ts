import { Injectable, Logger } from '@nestjs/common';
import * as Kavenegar from 'kavenegar';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly api = Kavenegar.KavenegarApi({
    apikey: process.env.KAVENEGAR_API_KEY ?? '',
  });

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`);

    if (!process.env.KAVENEGAR_API_KEY || !process.env.KAVENEGAR_SENDER) {
      this.logger.warn('Kavenegar env vars are missing; OTP was only logged.');
      return;
    }

    return new Promise((resolve) => {
      this.api.Send(
        {
          message: `Your verification code is: ${code}\nThis code is valid for 2 minutes.`,
          sender: process.env.KAVENEGAR_SENDER,
          receptor: phone,
        },
        (response: any, status: number) => {
          if (status !== 200) {
            this.logger.warn(
              `Kavenegar failed; OTP was only logged. status=${status} response=${JSON.stringify(response)}`,
            );
            resolve();
            return;
          }
          resolve();
        },
      );
    });
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    if (!process.env.KAVENEGAR_API_KEY || !process.env.KAVENEGAR_SENDER) {
      throw new Error('Kavenegar notification settings are missing');
    }

    await new Promise<void>((resolve, reject) => {
      this.api.Send(
        {
          message,
          sender: process.env.KAVENEGAR_SENDER,
          receptor: phone,
        },
        (response: unknown, status: number) => {
          if (status !== 200) {
            reject(new Error(`Kavenegar notification failed: ${status}`));
            return;
          }
          resolve();
        },
      );
    });
  }
}
