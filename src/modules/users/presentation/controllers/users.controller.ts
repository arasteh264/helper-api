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
import { PaginationQueryDto } from '../../../../shared/dto/pagination-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UpdateUserUseCase } from '../../application/update-user.use-case';
import { UpdateUserDto } from '../../application/dto/update-user.dto';
import * as tokenGeneratorPort from '../../../auth/domain/services/token-generator.port';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { VerifyRegistrationOtpDto } from '../../application/dto/verify-registration-otp.dto';
import { VerifyRegistrationOtpUseCase } from '../../application/verify-registration-otp.use-case';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { SmsService } from '../../../sms/sms.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getAllUserUseCase: GetAllUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly verifyRegistrationOtpUseCase: VerifyRegistrationOtpUseCase,
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {}

  @ApiOperation({ summary: 'Create a new user' })
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    await this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    });

    return { message: 'OTP sent' };
  }

  @ApiOperation({ summary: 'Verify registration OTP and create user' })
  @Post('verify-otp')
  async verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return this.verifyRegistrationOtpUseCase.execute(dto.phone, dto.code);
  }

  @ApiOperation({ summary: 'Resend OTP for a pending registration' })
  @Post('resend-otp')
  async resendRegistrationOtp(@Body() dto: { phone: string }) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { phone: dto.phone },
    });

    if (!pending) {
      throw new NotFoundException(
        'No pending registration found for this phone',
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 90 * 1000);

    await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { otpCode, otpExpiresAt },
    });

    await this.smsService.sendOtp(dto.phone, otpCode);

    return { message: 'OTP sent' };
  }

  @ApiOperation({ summary: 'Get all user by  search ' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async getAllUsers(@Query() query: PaginationQueryDto) {
    const result = await this.getAllUserUseCase.execute(query);
    return {
      ...result,
      items: result.items.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.getUserUseCase.execute(id);

    if (!user) {
      return null;
    }

    return UserResponseDto.fromEntity(user);
  }

  @ApiOperation({ summary: 'Update user information' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateUserUseCase.execute(id, dto);
    return UserResponseDto.fromEntity(user);
  }
}
