import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { UsersModule } from '../users/users.module';
import { AuthController } from './presentation/controllers/auth.controller';
import { LoginUseCase } from './application/login.use-case';
import { TOKEN_GENERATOR } from './domain/services/token-generator.token';
import { JwtTokenGenerator } from './infrastructure/services/jwt-token-generator';

@Module({
  imports: [
    UsersModule,
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
    {
      provide: TOKEN_GENERATOR,
      useClass: JwtTokenGenerator,
    },
  ],
})
export class AuthModule {}