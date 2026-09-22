import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository.token';
import type { PasswordHasher } from '../../users/domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../../users/domain/services/password-hasher.token';
import type { TokenGenerator } from '../domain/services/token-generator.port';
import { TOKEN_GENERATOR } from '../domain/services/token-generator.token';
import { LoginDto } from './dto/login.dto';
import { UserStatus } from '../../users/domain/entities/user-status.enum';

function isEmail(value: string): boolean {
  return value.includes('@');
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_GENERATOR)
    private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = isEmail(dto.identifier)
      ? await this.userRepository.findByEmail(dto.identifier)
      : await this.userRepository.findByPhone(dto.identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Please verify your phone number first');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account has no password set. Try logging in with Google.',
      );
    }

    const isPasswordValid = await this.passwordHasher.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.tokenGenerator.generate({
      userId: user.id,
      role: user.role,
    });

    return { accessToken };
  }
}
