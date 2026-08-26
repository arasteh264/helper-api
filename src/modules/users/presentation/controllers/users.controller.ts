import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { CreateUserUseCase } from '../../application/create-user.use-case';
import { GetUserUseCase } from '../../application/get-user.use-case';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { GetAllUserUseCase } from '../../application/get-allUser.use-case';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateUserUseCase } from '../../application/update-user.use-case';
import { UpdateUserDto } from '../../application/dto/update-user.dto';
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getAllUserUseCase: GetAllUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
  ) {}

  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    });
  }

 @ApiOperation({ summary: 'Get all user by  search ' })
  @Get()
  async getAllUsers(@Query() query: PaginationQueryDto) {
    return this.getAllUserUseCase.execute(query);
  }

  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: 200, description: 'User found.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.getUserUseCase.execute(id);

    if (!user) {
      return null;
    }

    return UserResponseDto.fromEntity(user);
  }


@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
): Promise<UserResponseDto> {
  const user = await this.updateUserUseCase.execute(id, dto);
  return UserResponseDto.fromEntity(user);
}

}
