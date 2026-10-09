import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { OtpSender } from '../domain/services/otp-sender.port';
import { OTP_SENDER } from '../domain/services/otp-sender.token';
import { User } from '../../users/domain/entities/user.entity';
import { UserStatus } from '../../users/domain/entities/user-status.enum';
import {
  OTP_TTL_SECONDS,
  RedisOtpStore,
} from '../infrastructure/services/redis-otp.store';

function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

@Injectable()
export class RequestOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(OTP_SENDER)
    private readonly otpSender: OtpSender,
    private readonly otpStore: RedisOtpStore,
  ) {}

  async execute(phone: string): Promise<void> {
    let user = await this.userRepository.findByPhone(phone);
    const code = generateOtpCode();

    if (!user) {
      user = User.createUnverified(
        'New User',
        `${phone}@placeholder.local`,
        phone,
        null,
      );
      await this.userRepository.save(user);
    } else if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account is suspended');
    }

    await this.otpStore.save('login', phone, code);
    try {
      await this.otpSender.send(user.email, code, OTP_TTL_SECONDS);
    } catch (error) {
      await this.otpStore.delete('login', phone);
      throw error;
    }
  }
}
