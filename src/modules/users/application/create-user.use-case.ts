import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import * as passwordHasherPort from '../domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../domain/services/password-hasher.token';
import type { OtpSender } from '../../auth/domain/services/otp-sender.port';
import { OTP_SENDER } from '../../auth/domain/services/otp-sender.token';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { TokenGenerator } from '../../auth/domain/services/token-generator.port';
import { TOKEN_GENERATOR } from '../../auth/domain/services/token-generator.token';
import { User } from '../domain/entities/user.entity';

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
    @Inject(OTP_SENDER)
    private readonly otpSender: OtpSender,
    private readonly prisma: PrismaService,
    @Inject(TOKEN_GENERATOR)
    private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(
    input: CreateUserInput,
  ): Promise<
    | { registrationCompleted: true; accessToken: string }
    | { registrationCompleted: false }
  > {
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
    if (process.env.REQUIRE_REGISTRATION_OTP !== 'true') {
      const user = User.create(
        input.name,
        input.email,
        input.phone,
        passwordHash,
      );
      await this.userRepository.save(user);
      await this.prisma.pendingRegistration.deleteMany({
        where: { phone: input.phone },
      });

      return {
        registrationCompleted: true,
        accessToken: this.tokenGenerator.generate({
          userId: user.id,
          role: user.role,
        }),
      };
    }

    const otpCode = generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + 90 * 1000);
    
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
    await this.otpSender.send(input.email, otpCode, 90);
    return { registrationCompleted: false };
  }
}
