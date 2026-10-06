import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { GetCustomerOverviewUseCase } from '../application/get-customer-overview.use-case';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { TokenPayload } from '../../auth/domain/services/token-generator.port';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from '../application/dto/create-customer-address.dto';

@ApiTags('customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer')
export class CustomersController {
  constructor(
    private readonly getOverview: GetCustomerOverviewUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Customer profile with wallet and request stats' })
  profile(@CurrentUser() user: { userId: string }) {
    return this.getOverview.execute(user.userId);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List my saved addresses' })
  async getAddresses(@CurrentUser() user: TokenPayload) {
    this.assertCustomer(user);
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId: user.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return addresses.map((address) => this.toAddressResponse(address));
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Save a customer address' })
  async createAddress(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    this.assertCustomer(user);
    const { type, ...fields } = dto;
    const data = {
      ...fields,
      type: type.toUpperCase() as 'HOME' | 'WORK' | 'OTHER',
    };
    const address = await this.withDefaultConflictHandling(() =>
      this.prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.customerAddress.updateMany({
            where: { customerId: user.userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.customerAddress.create({
          data: { ...data, customerId: user.userId },
        });
      }),
    );
    return this.toAddressResponse(address);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update one of my saved addresses' })
  async updateAddress(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    this.assertCustomer(user);
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id, customerId: user.userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('آدرس پیدا نشد');

    const { type, ...fields } = dto;
    const data = {
      ...fields,
      ...(type !== undefined && {
        type: type.toUpperCase() as 'HOME' | 'WORK' | 'OTHER',
      }),
    };
    const address = await this.withDefaultConflictHandling(() =>
      this.prisma.$transaction(async (tx) => {
        if (data.isDefault === true) {
          await tx.customerAddress.updateMany({
            where: {
              customerId: user.userId,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }
        return tx.customerAddress.update({
          where: { id },
          data,
        });
      }),
    );
    return this.toAddressResponse(address);
  }

  @Delete('addresses/:id')
  @ApiOperation({ summary: 'Delete one of my saved addresses' })
  async deleteAddress(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    this.assertCustomer(user);
    const result = await this.prisma.customerAddress.deleteMany({
      where: { id, customerId: user.userId },
    });
    if (result.count === 0) throw new NotFoundException('آدرس پیدا نشد');
    return { message: 'آدرس حذف شد' };
  }

  private assertCustomer(user: TokenPayload) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('این بخش فقط برای مشتریان در دسترس است');
    }
  }

  private async withDefaultConflictHandling<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Error &&
        error.constructor.name === 'PrismaClientKnownRequestError' &&
        Object.getOwnPropertyDescriptor(error, 'code')?.value === 'P2002'
      ) {
        throw new ConflictException(
          'آدرس پیش‌فرض دیگری هم‌زمان ثبت شده است؛ دوباره تلاش کنید',
        );
      }
      throw error;
    }
  }

  private toAddressResponse(address: {
    id: string;
    title: string;
    type: string;
    receiverName: string;
    receiverPhone: string;
    city: string;
    fullAddress: string;
    plaque: string;
    unit: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    isDefault: boolean;
  }) {
    const { latitude, longitude, ...fields } = address;
    return {
      ...fields,
      type: address.type.toLowerCase(),
      ...(latitude !== null && { latitude }),
      ...(longitude !== null && { longitude }),
    };
  }
}
