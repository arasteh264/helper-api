import { Global, Module } from '@nestjs/common';
import { RedisOtpStore } from '../../modules/auth/infrastructure/services/redis-otp.store';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, RedisOtpStore],
  exports: [RedisService, RedisOtpStore],
})
export class RedisModule {}
