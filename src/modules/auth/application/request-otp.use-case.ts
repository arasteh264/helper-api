import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { OtpSender } from '../domain/services/otp-sender.port';
import { OTP_SENDER } from '../domain/services/otp-sender.token';
import { User } from '../../users/domain/entities/user.entity';
import { UserStatus } from '../../users/domain/entities/user-status.enum';

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class RequestOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(OTP_SENDER)
    private readonly otpSender: OtpSender,
  ) {}

  async execute(phone: string): Promise<void> {
    let user = await this.userRepository.findByPhone(phone);
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    if (!user) {
      user = User.createUnverified(
        'New User',
        `${phone}@placeholder.local`,
        phone,
        null,
        code,
        expiresAt,
      );
      await this.userRepository.save(user);
      await this.otpSender.send(phone, code);
      return;
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account is suspended');
    }

    user.setOtp(code, expiresAt);
    console.log(code);
    await this.userRepository.update(user);

    await this.otpSender.send(phone, code);
  }
}
