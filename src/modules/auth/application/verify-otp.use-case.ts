import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { TokenGenerator } from '../domain/services/token-generator.port';
import { TOKEN_GENERATOR } from '../domain/services/token-generator.token';
import { UserStatus } from '../../users/domain/entities/user-status.enum';
import { RedisOtpStore } from '../infrastructure/services/redis-otp.store';

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(TOKEN_GENERATOR)
    private readonly tokenGenerator: TokenGenerator,
    private readonly otpStore: RedisOtpStore,
  ) {}

  async execute(phone: string, code: string): Promise<{ accessToken: string }> {
    const user = await this.userRepository.findByPhone(phone);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('This account is suspended');
    }

    const isValid = await this.otpStore.consumeIfMatches('login', phone, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (user.status === UserStatus.INACTIVE) {
      user.activate();
    }

    await this.userRepository.update(user);

    const accessToken = this.tokenGenerator.generate({
      userId: user.id,
      role: user.role,
    });

    return { accessToken };
  }
}
