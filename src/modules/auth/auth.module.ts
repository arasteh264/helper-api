import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { UsersModule } from '../users/users.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { LoginUseCase } from './application/login.use-case';
import { RequestOtpUseCase } from './application/request-otp.use-case';
import { VerifyOtpUseCase } from './application/verify-otp.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { TOKEN_GENERATOR } from './domain/services/token-generator.token';
import { JwtTokenGenerator } from './infrastructure/services/jwt-token-generator';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { OTP_SENDER } from './domain/services/otp-sender.token';
import { LogOtpSender } from './infrastructure/services/log-otp-sender';
import { EMAIL_SENDER } from './domain/services/email-sender.token';
import { LogEmailSender } from './infrastructure/services/log-email-sender';
import { NodemailerEmailSender } from './infrastructure/services/nodemailer-email-sender';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    JwtStrategy,
    {
      provide: TOKEN_GENERATOR,
      useClass: JwtTokenGenerator,
    },
    {
      provide: OTP_SENDER,
      useClass: LogOtpSender,
    },
    {
      provide: EMAIL_SENDER,
      useClass: NodemailerEmailSender,
    },
  ],
})
export class AuthModule {}