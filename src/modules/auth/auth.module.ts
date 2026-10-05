import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { LoginUseCase } from './application/login.use-case';
import { RequestOtpUseCase } from './application/request-otp.use-case';
import { VerifyOtpUseCase } from './application/verify-otp.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { OTP_SENDER } from './domain/services/otp-sender.token';
import { EMAIL_SENDER } from './domain/services/email-sender.token';
import { NodemailerEmailSender } from './infrastructure/services/nodemailer-email-sender';
import { SmsModule } from '../sms/sms.module';
import { KavenegarOtpSender } from './infrastructure/services/kavenegar-otp-sender';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { CustomerPasswordController } from './presentation/controllers/customer-password.controller';
import { TokenModule } from './token.module';

@Module({
  imports: [UsersModule, TokenModule, SmsModule, PassportModule],
  controllers: [AuthController, CustomerPasswordController],
  providers: [
    LoginUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    JwtStrategy,
    {
      provide: OTP_SENDER,
      useClass: KavenegarOtpSender,
    },
    {
      provide: EMAIL_SENDER,
      useClass: NodemailerEmailSender,
    },
  ],
})
export class AuthModule {}
