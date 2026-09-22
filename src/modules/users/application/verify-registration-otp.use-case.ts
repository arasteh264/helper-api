import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { User } from '../domain/entities/user.entity';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import type { UserRepository } from '../domain/repositories/user.repository';

@Injectable()
export class VerifyRegistrationOtpUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(phone: string, code: string): Promise<User> {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { phone },
    });

    if (!pending) {
      throw new BadRequestException('No pending registration found');
    }

    if (
      pending.otpCode !== code ||
      pending.otpExpiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const existingByEmail = await this.userRepository.findByEmail(
      pending.email,
    );
    if (existingByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingByPhone = await this.userRepository.findByPhone(
      pending.phone,
    );
    if (existingByPhone) {
      throw new ConflictException('User with this phone already exists');
    }

    const user = User.create(
      pending.name,
      pending.email,
      pending.phone,
      pending.passwordHash,
    );

    await this.userRepository.save(user);
    await this.prisma.pendingRegistration.delete({ where: { id: pending.id } });

    return user;
  }
}
