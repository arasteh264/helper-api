import { Body, Controller, Post } from '@nestjs/common';
import * as createUserUseCase from '../../application/create-user.use-case';


@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: createUserUseCase.CreateUserUseCase,
  ) {}

  @Post()
  async createUser(
    @Body() body: createUserUseCase.CreateUserInput,
  ): Promise<void> {
    await this.createUserUseCase.execute(body);
  }
}