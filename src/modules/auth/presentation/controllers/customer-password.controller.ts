import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangePasswordUseCase } from '../../application/change-password.use-case';
import { ChangePasswordDto } from '../../application/dto/change-password.dto';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { TokenPayload } from '../../domain/services/token-generator.port';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer')
export class CustomerPasswordController {
  constructor(private readonly changePasswordUseCase: ChangePasswordUseCase) {}

  @ApiOperation({ summary: 'Change the current customer password' })
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() currentUser: TokenPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.changePasswordUseCase.execute(
      currentUser.userId,
      dto.currentPassword,
      dto.newPassword,
    );

    return { message: 'Password changed successfully.' };
  }
}
