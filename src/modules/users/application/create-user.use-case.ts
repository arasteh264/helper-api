import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import * as passwordHasherPort from '../domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../domain/services/password-hasher.token';
import { SmsService } from '../../sms/sms.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: passwordHasherPort.PasswordHasher,
    private readonly smsService: SmsService,
    private readonly prisma: PrismaService,
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
    const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await this.prisma.pendingRegistration.upsert({
      where: { phone: input.phone },
      update: {
        name: input.name,
        email: input.email,
        passwordHash,
        otpCode,
        otpExpiresAt,
      },
      create: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash,
        otpCode,
        otpExpiresAt,
      },
    });
    await this.smsService.sendOtp(input.phone, otpCode);
  }
}
