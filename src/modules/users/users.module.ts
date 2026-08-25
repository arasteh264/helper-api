import { Module } from '@nestjs/common';

import { UsersController } from './presentation/controllers/users.controller';
import { USER_REPOSITORY } from './domain/repositories/user.repository.token';
import { CreateUserUseCase } from './application/create-user.use-case';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { GetUserUseCase } from './application/get-user.use-case';
import { GetAllUserUseCase } from './application/get-allUser.use-case';

@Module({
  controllers: [UsersController],

  providers: [
    PrismaService,
    CreateUserUseCase,
    GetUserUseCase,
    GetAllUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
})
export class UsersModule {}
