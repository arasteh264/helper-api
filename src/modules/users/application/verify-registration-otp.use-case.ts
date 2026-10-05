import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { User } from '../domain/entities/user.entity';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import type { UserRepository } from '../domain/repositories/user.repository';
import type { TokenGenerator } from '../../auth/domain/services/token-generator.port';
import { TOKEN_GENERATOR } from '../../auth/domain/services/token-generator.token';

@Injectable()
export class VerifyRegistrationOtpUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(TOKEN_GENERATOR)
    private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(phone: string, code: string): Promise<{ accessToken: string }> {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { phone },
    });
    if (!pending) {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'No pending registration found',
      });
    }

    if (pending.otpExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'EXPIRED_OTP',
        message: 'Code expired',
      });
    }

    if (pending.otpCode !== code) {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'Invalid code',
      });
    }

    if (await this.userRepository.findByEmail(pending.email)) {
      throw new ConflictException({
        code: 'DUPLICATE_EMAIL',
        message: 'User with this email already exists',
      });
    }

    if (await this.userRepository.findByPhone(pending.phone)) {
      throw new ConflictException({
        code: 'DUPLICATE_PHONE',
        message: 'User with this phone already exists',
      });
    }

    const user = User.create(
      pending.name,
      pending.email,
      pending.phone,
      pending.passwordHash,
    );

    await this.userRepository.save(user);
    await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });

    const accessToken = this.tokenGenerator.generate({
      userId: user.id,
      role: user.role,
    });

    return { accessToken };
  }
}
