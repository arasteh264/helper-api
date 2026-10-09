import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import * as passwordHasherPort from '../domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../domain/services/password-hasher.token';
import type { OtpSender } from '../../auth/domain/services/otp-sender.port';
import { OTP_SENDER } from '../../auth/domain/services/otp-sender.token';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { randomInt } from 'node:crypto';
import {
  OTP_TTL_SECONDS,
  RedisOtpStore,
} from '../../auth/infrastructure/services/redis-otp.store';

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: passwordHasherPort.PasswordHasher,
    @Inject(OTP_SENDER)
    private readonly otpSender: OtpSender,
    private readonly prisma: PrismaService,
    private readonly otpStore: RedisOtpStore,
  ) {}

  async execute(input: CreateUserInput): Promise<void> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const existingByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingByPhone) {
      throw new ConflictException('User with this phone already exists');
    }

    const pendingByEmail = await this.prisma.pendingRegistration.findUnique({
      where: { email: input.email },
    });
    if (pendingByEmail && pendingByEmail.phone !== input.phone) {
      throw new ConflictException('Registration with this email is pending');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const otpCode = generateOtpCode();

    await this.prisma.pendingRegistration.upsert({
      where: { phone: input.phone },
      update: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      create: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
      },
    });
    await this.otpStore.save('registration', input.phone, otpCode);
    try {
      await this.otpSender.send(input.email, otpCode, OTP_TTL_SECONDS);
    } catch (error) {
      await this.otpStore.delete('registration', input.phone);
      throw error;
    }
  }
}
