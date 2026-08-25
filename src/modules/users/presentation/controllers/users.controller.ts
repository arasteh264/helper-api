import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { CreateUserUseCase } from '../../application/create-user.use-case';
import { GetUserUseCase } from '../../application/get-user.use-case';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { GetAllUserUseCase } from '../../application/get-allUser.use-case';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getAllUserUseCase: GetAllUserUseCase,
  ) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    });
  }

 @Get()
async getAllUsers(@Query() query: PaginationQueryDto) {
  return this.getAllUserUseCase.execute(query);
}


  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.getUserUseCase.execute(id);

    if (!user) {
      return null;
    }

    return UserResponseDto.fromEntity(user);
  }
}
