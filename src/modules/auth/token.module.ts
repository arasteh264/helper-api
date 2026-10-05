import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { TOKEN_GENERATOR } from './domain/services/token-generator.token';
import { JwtTokenGenerator } from './infrastructure/services/jwt-token-generator';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as StringValue,
      },
    }),
  ],
  providers: [
    {
      provide: TOKEN_GENERATOR,
      useClass: JwtTokenGenerator,
    },
  ],
  exports: [TOKEN_GENERATOR],
})
export class TokenModule {}
