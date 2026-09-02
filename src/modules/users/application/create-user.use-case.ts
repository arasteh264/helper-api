import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import { User } from '../domain/entities/user.entity';
import * as passwordHasherPort from '../domain/services/password-hasher.port';
import { PASSWORD_HASHER } from '../domain/services/password-hasher.token';

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: passwordHasherPort.PasswordHasher,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const existingByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingByPhone) {
      throw new ConflictException('User with this phone already exists');
    }
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = User.create(
      input.name,
      input.email,
      input.phone,
      passwordHash,
    );

    await this.userRepository.save(user);

    return user;
  }
}
