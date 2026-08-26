import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import { User } from '../domain/entities/user.entity';

export interface CreateUserCommand {
  name: string;
  email: string;
  phone: string;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
  ) {}

  async execute(input: CreateUserCommand): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    const existingByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingByPhone) {
      throw new ConflictException('User with this phone already exists');
    }
    const user = User.create(input.name, input.email, input.phone);

    await this.userRepository.save(user);

    return user;
  }
}
