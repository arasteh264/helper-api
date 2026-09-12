import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { OtpSender } from '../domain/services/otp-sender.port';
import { OTP_SENDER } from '../domain/services/otp-sender.token';
import { User } from '../../users/domain/entities/user.entity';

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

    if (!user) {
      user = User.create('New User', `${phone}@placeholder.local`, phone, null);
      await this.userRepository.save(user);
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); 

    user.setOtp(code, expiresAt);
    await this.userRepository.update(user);

    await this.otpSender.send(phone, code);
  }
}