import { Module } from '@nestjs/common';

import { UsersController } from './presentation/controllers/users.controller';
import { USER_REPOSITORY } from './domain/repositories/user.repository.token';
import { CreateUserUseCase } from './application/create-user.use-case';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';

import { GetUserUseCase } from './application/get-user.use-case';
import { GetAllUserUseCase } from './application/get-allUser.use-case';
import { UpdateUserUseCase } from './application/update-user.use-case';
import { PASSWORD_HASHER } from './domain/services/password-hasher.token';
import { BcryptPasswordHasher } from './infrastructure/services/bcrypt-password-hasher';

@Module({
  controllers: [UsersController],

  providers: [
    CreateUserUseCase,
    GetUserUseCase,
    GetAllUserUseCase,
    UpdateUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
     {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
  ],
   exports: [USER_REPOSITORY, PASSWORD_HASHER],
})
export class UsersModule {}
