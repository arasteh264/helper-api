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
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { CustomerPasswordController } from './presentation/controllers/customer-password.controller';
import { TokenModule } from './token.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, TokenModule, NotificationsModule, PassportModule],
  controllers: [AuthController, CustomerPasswordController],
  providers: [
    LoginUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    JwtStrategy,
  ],
})
export class AuthModule {}
