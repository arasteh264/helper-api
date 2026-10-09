import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/cache/redis.service';

export const OTP_TTL_SECONDS = 90;

export type OtpPurpose = 'login' | 'registration';

@Injectable()
export class RedisOtpStore {
  constructor(private readonly redis: RedisService) {}

  save(purpose: OtpPurpose, identifier: string, code: string): Promise<void> {
    return this.redis.setEphemeralValue(
      this.getKey(purpose, identifier),
      code,
      OTP_TTL_SECONDS,
    );
  }

  get(purpose: OtpPurpose, identifier: string): Promise<string | null> {
    return this.redis.getEphemeralValue(this.getKey(purpose, identifier));
  }

  consumeIfMatches(
    purpose: OtpPurpose,
    identifier: string,
    code: string,
  ): Promise<boolean> {
    return this.redis.consumeEphemeralValueIfMatches(
      this.getKey(purpose, identifier),
      code,
    );
  }

  delete(purpose: OtpPurpose, identifier: string): Promise<void> {
    return this.redis.deleteEphemeralValue(this.getKey(purpose, identifier));
  }

  private getKey(purpose: OtpPurpose, identifier: string): string {
    const identifierHash = createHash('sha256')
      .update(identifier)
      .digest('hex');
    return `otp:${purpose}:${identifierHash}`;
  }
}
