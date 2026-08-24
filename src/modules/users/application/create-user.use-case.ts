import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';
import * as userRepository from '../domain/repositories/user.repository';
import { User } from '../domain/entities/user.entity';



export interface CreateUserInput {
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

  async execute(input: CreateUserInput): Promise<void> {
    const user = User.create(
      input.name,
      input.email,
      input.phone,
    );

    await this.userRepository.save(user);
  }
}