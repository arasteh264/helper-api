import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { CreateUserUseCase } from '../../application/create-user.use-case';
import { GetUserUseCase } from '../../application/get-user.use-case';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { GetAllUserUseCase } from '../../application/get-allUser.use-case';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateUserUseCase } from '../../application/update-user.use-case';
import { UpdateUserDto } from '../../application/dto/update-user.dto';
import * as tokenGeneratorPort from '@/modules/auth/domain/services/token-generator.port';
import { CurrentUser } from '@/modules/auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/presentation/guards/jwt-auth.guard';
import { TokenPayload } from '@/modules/auth/domain/services/token-generator.port';
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
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    return this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    });
  }

  @ApiOperation({ summary: 'Get all user by  search ' })
  @Get()
  async getAllUsers(@Query() query: PaginationQueryDto) {
    return this.getAllUserUseCase.execute(query);
  }

  @ApiOperation({ summary: 'Get current logged-in user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() currentUser: tokenGeneratorPort.TokenPayload) {
    const user = await this.getUserUseCase.execute(currentUser.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }

  @ApiOperation({ summary: 'Get user by id' })
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.getUserUseCase.execute(id);

    if (!user) {
      return null;
    }

    return UserResponseDto.fromEntity(user);
  }

  @ApiOperation({ summary: 'Update user information' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(id, dto);
    return UserResponseDto.fromEntity(user);
  }
}
