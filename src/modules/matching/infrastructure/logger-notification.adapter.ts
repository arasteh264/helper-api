// infrastructure/logger-notification.adapter.ts
import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPort } from '../domain/notification.port';

// TODO: جایگزین با پیاده‌سازی SMS (مثلاً کاوه‌نگار) بدون تغییر در use case
@Injectable()
export class LoggerNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(LoggerNotificationAdapter.name);

  async notifyNewRequest(input: {
    phone: string;
    distanceKm: number | null;
  }): Promise<void> {
    const distance = input.distanceKm !== null ? `${input.distanceKm} کیلومتر` : 'نامشخص';
    this.logger.log(
      `SMS → ${input.phone}: درخواست جدیدی برای خدمات شما ثبت شده است. فاصله تقریبی: ${distance}. برای مشاهده وارد پنل Helper شوید.`,
    );
  }
}