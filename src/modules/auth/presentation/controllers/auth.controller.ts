import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginUseCase } from '../../application/login.use-case';
import { LoginDto } from '../../application/dto/login.dto';
import { RequestOtpUseCase } from '../../application/request-otp.use-case';
import { VerifyOtpUseCase } from '../../application/verify-otp.use-case';
import { RequestOtpDto } from '../../application/dto/request-otp.dto';
import { VerifyOtpDto } from '../../application/dto/verify-otp.dto';
import { ForgotPasswordUseCase } from '../../application/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../application/reset-password.use-case';
import { ForgotPasswordDto } from '../../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../application/dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly requestOtpUseCase: RequestOtpUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @ApiOperation({ summary: 'Login with email or phone' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @ApiOperation({ summary: 'Request an OTP code' })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.requestOtpUseCase.execute(dto.phone);
    return { message: 'OTP sent' };
  }

  @ApiOperation({ summary: 'Verify OTP and login' })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.verifyOtpUseCase.execute(dto.phone, dto.code);
  }

  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link has been sent.',
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.forgotPasswordUseCase.execute(dto.email);
    return { message: 'If this email exists, a reset link has been sent.' };
  }

  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token.' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto.token, dto.newPassword);
    return { message: 'Password reset successfully.' };
  }
}