import { Module } from '@nestjs/common';
import { EMAIL_SENDER } from '../auth/domain/services/email-sender.token';
import { OTP_SENDER } from '../auth/domain/services/otp-sender.token';
import { EmailOtpSender } from '../auth/infrastructure/services/email-otp-sender';
import { NodemailerEmailSender } from '../auth/infrastructure/services/nodemailer-email-sender';
import { SmsModule } from '../sms/sms.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [SmsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: EMAIL_SENDER, useClass: NodemailerEmailSender },
    { provide: OTP_SENDER, useClass: EmailOtpSender },
  ],
  exports: [NotificationsService, EMAIL_SENDER, OTP_SENDER],
})
export class NotificationsModule {}
