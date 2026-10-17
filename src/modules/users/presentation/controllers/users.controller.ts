import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
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
import type { OtpSender } from '../../../auth/domain/services/otp-sender.port';
import { OTP_SENDER } from '../../../auth/domain/services/otp-sender.token';
import { IMAGE_UPLOADER } from '../../../../shared/storage/image-uploader.token';
import type { ImageUploader } from '../../../../shared/storage/image-uploader.port';

const USER_DELETION_SELECT = {
  id: true,
  role: true,
  serviceRequests: { take: 1, select: { id: true } },
  reviewsGiven: { take: 1, select: { id: true } },
  sentChatMessages: { take: 1, select: { id: true } },
  moderatedChatMessages: { take: 1, select: { id: true } },
  disputeMessages: { take: 1, select: { id: true } },
  providerOnboardingInvitations: { take: 1, select: { id: true } },
  providerProfile: {
    select: {
      id: true,
      acceptedServiceRequests: { take: 1, select: { id: true } },
      requestDeclines: { take: 1, select: { serviceRequestId: true } },
      requestInvitations: { take: 1, select: { id: true } },
      reviews: { take: 1, select: { id: true } },
      wallet: {
        select: {
          id: true,
          balance: true,
          totalEarned: true,
          totalWithdrawn: true,
          transactions: { take: 1, select: { id: true } },
          payouts: { take: 1, select: { id: true } },
        },
      },
    },
  },
  customerProfile: {
    select: {
      id: true,
      wallet: {
        select: {
          id: true,
          balance: true,
          totalSpent: true,
          topups: { take: 1, select: { id: true } },
        },
      },
    },
  },
} as const;

type UserDeletionRecord = {
  id: string;
  role: string;
  serviceRequests: { id: string }[];
  reviewsGiven: { id: string }[];
  sentChatMessages: { id: string }[];
  moderatedChatMessages: { id: string }[];
  disputeMessages: { id: string }[];
  providerOnboardingInvitations: { id: string }[];
  providerProfile: {
    id: string;
    acceptedServiceRequests: { id: string }[];
    requestDeclines: { serviceRequestId: string }[];
    requestInvitations: { id: string }[];
    reviews: { id: string }[];
    wallet: {
      id: string;
      balance: number;
      totalEarned: number;
      totalWithdrawn: number;
      transactions: { id: string }[];
      payouts: { id: string }[];
    } | null;
  } | null;
  customerProfile: {
    id: string;
    wallet: {
      id: string;
      balance: number;
      totalSpent: number;
      topups: { id: string }[];
    } | null;
  } | null;
};

function canDeleteUser(user: UserDeletionRecord): boolean {
  if (
    user.role === 'ADMIN' ||
    user.serviceRequests.length > 0 ||
    user.reviewsGiven.length > 0 ||
    user.sentChatMessages.length > 0 ||
    user.moderatedChatMessages.length > 0 ||
    user.disputeMessages.length > 0 ||
    user.providerOnboardingInvitations.length > 0
  ) {
    return false;
  }

  const providerProfile = user.providerProfile;
  if (
    providerProfile &&
    (providerProfile.acceptedServiceRequests.length > 0 ||
      providerProfile.requestDeclines.length > 0 ||
      providerProfile.requestInvitations.length > 0 ||
      providerProfile.reviews.length > 0 ||
      (providerProfile.wallet &&
        (providerProfile.wallet.balance !== 0 ||
          providerProfile.wallet.totalEarned !== 0 ||
          providerProfile.wallet.totalWithdrawn !== 0 ||
          providerProfile.wallet.transactions.length > 0 ||
          providerProfile.wallet.payouts.length > 0)))
  ) {
    return false;
  }

  const customerWallet = user.customerProfile?.wallet;
  if (
    customerWallet &&
    (customerWallet.balance !== 0 ||
      customerWallet.totalSpent !== 0 ||
      customerWallet.topups.length > 0)
  ) {
    return false;
  }

  return user.role === 'CUSTOMER' || user.role === 'PROVIDER';
}

@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getAllUserUseCase: GetAllUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly verifyRegistrationOtpUseCase: VerifyRegistrationOtpUseCase,
    private readonly prisma: PrismaService,
    @Inject(OTP_SENDER) private readonly otpSender: OtpSender,
    @Inject(IMAGE_UPLOADER) private readonly imageUploader: ImageUploader,
  ) {}

  @ApiOperation({ summary: 'Create a new user' })
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    const result = await this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    });

    if (result.registrationCompleted) {
      return {
        message: 'Registration completed',
        registrationCompleted: true,
        accessToken: result.accessToken,
      };
    }

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

    await this.otpSender.send(pending.email, otpCode, 90);

    return { message: 'OTP sent' };
  }

  @ApiOperation({ summary: 'Get all user by  search ' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  async getAllUsers(@Query() query: PaginationQueryDto) {
    const result = await this.getAllUserUseCase.execute(query);
    const deletionRecords = result.items.length
      ? await this.prisma.user.findMany({
          where: { id: { in: result.items.map((user) => user.id) } },
          select: USER_DELETION_SELECT,
        })
      : [];
    const deletableIds = new Set(
      deletionRecords.filter(canDeleteUser).map((user) => user.id),
    );

    return {
      ...result,
      items: result.items.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email.endsWith('@placeholder.local')
          ? null
          : user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        canDelete: deletableIds.has(user.id),
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

  @ApiOperation({
    summary: 'Delete a customer or provider account with no service or financial history',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const mediaPublicIds = await this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id },
          select: USER_DELETION_SELECT,
        });
        if (!user) throw new NotFoundException('کاربر موردنظر پیدا نشد.');
        if (!canDeleteUser(user)) {
          throw new ConflictException(
            'این حساب سابقه‌ی درخواست، کار، پیام یا تراکنش مالی دارد و قابل حذف نیست.',
          );
        }

        const providerMedia = user.providerProfile
          ? await transaction.providerProfile.findUnique({
              where: { id: user.providerProfile.id },
              select: {
                avatarPublicId: true,
                documents: { select: { publicId: true } },
                portfolioItems: {
                  select: {
                    images: { select: { publicId: true } },
                  },
                },
              },
            })
          : null;
        const mediaPublicIds = providerMedia
          ? [
              providerMedia.avatarPublicId,
              ...providerMedia.documents.map(({ publicId }) => publicId),
              ...providerMedia.portfolioItems.flatMap((item) =>
                item.images.map(({ publicId }) => publicId),
              ),
            ].filter((publicId): publicId is string => Boolean(publicId))
          : [];

        if (user.providerProfile) {
          const providerProfileId = user.providerProfile.id;
          await transaction.providerSkill.deleteMany({
            where: { providerProfileId },
          });
          await transaction.providerSpecialty.deleteMany({
            where: { providerProfileId },
          });
          await transaction.providerDocument.deleteMany({
            where: { providerProfileId },
          });
          await transaction.portfolioItem.deleteMany({
            where: { providerProfileId },
          });
          await transaction.providerBankAccount.deleteMany({
            where: { providerProfileId },
          });
          if (user.providerProfile.wallet) {
            await transaction.wallet.delete({
              where: { providerProfileId },
            });
          }
          await transaction.providerProfile.delete({
            where: { id: providerProfileId },
          });
        }

        if (user.customerProfile) {
          if (user.customerProfile.wallet) {
            await transaction.customerWallet.delete({
              where: { customerProfileId: user.customerProfile.id },
            });
          }
          await transaction.customerProfile.delete({
            where: { id: user.customerProfile.id },
          });
        }

        await transaction.user.delete({ where: { id } });
        return mediaPublicIds;
      },
      { isolationLevel: 'Serializable' },
    );

    const cleanupResults = await Promise.allSettled(
      [...new Set(mediaPublicIds)].map((publicId) =>
        this.imageUploader.delete(publicId),
      ),
    );
    const failedCleanupCount = cleanupResults.filter(
      (result) => result.status === 'rejected',
    ).length;
    if (failedCleanupCount) {
      this.logger.error(
        `User ${id} was deleted, but ${failedCleanupCount} stored image(s) could not be removed`,
      );
      return {
        id,
        message: 'حساب کاربر حذف شد.',
        cleanupWarning: 'حساب حذف شد، اما حذف بعضی تصاویر ذخیره‌شده ناموفق بود.',
      };
    }

    return { id, message: 'حساب کاربر حذف شد.' };
  }
}
