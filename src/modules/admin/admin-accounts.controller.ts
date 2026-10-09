import {
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { UpdateAccountStatusDto } from './admin-operations.dto';

@ApiTags('Admin - Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/users')
export class AdminAccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary:
      'Suspend or reactivate a customer/provider account with an audit reason',
  })
  @Patch(':userId/status')
  async updateStatus(
    @CurrentUser() admin: TokenPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    if (userId === admin.userId) {
      throw new ForbiddenException(
        'مدیر نمی‌تواند حساب خودش را از این مسیر تغییر وضعیت دهد',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد');
    if (user.role === 'ADMIN') {
      throw new ForbiddenException(
        'تغییر وضعیت حساب مدیر از این مسیر مجاز نیست',
      );
    }
    if (user.status === dto.status) {
      return { id: user.id, status: user.status, changed: false };
    }

    const changed = await this.prisma.$transaction(async (tx) => {
      const update = await tx.user.updateMany({
        where: { id: userId, status: user.status },
        data: { status: dto.status },
      });
      if (!update.count)
        throw new ConflictException(
          'وضعیت حساب هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید',
        );

      if (user.role === 'PROVIDER' && dto.status === 'SUSPENDED') {
        await tx.providerProfile.updateMany({
          where: { userId },
          data: { isAvailable: false },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.userId,
          action:
            dto.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
          targetType: 'USER',
          targetId: userId,
          reason: dto.reason.trim(),
          beforeState: { status: user.status },
          afterState: { status: dto.status },
        },
      });
      return true;
    });

    return { id: user.id, status: dto.status, changed };
  }
}
