import { Inject, Injectable } from '@nestjs/common';

import { User } from '../domain/entities/user.entity';
import type { UserRepository } from '../domain/repositories/user.repository';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.token';

@Injectable()
export class GetUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
  ) {}

  async execute(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}