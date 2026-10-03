import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/presentation/guards/admin.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { PaymentsService } from './payments.service';
import { CreateCustomerWalletTopupDto } from './create-customer-wallet-topup.dto';

@ApiTags('Customer Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer/wallet')
export class CustomerWalletPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my customer wallet balance and top-ups' })
  getWallet(@CurrentUser() user: TokenPayload) {
    this.assertCustomer(user);
    return this.paymentsService.getCustomerWallet(user.userId);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Start a customer wallet top-up through Zarinpal' })
  createTopup(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCustomerWalletTopupDto,
  ) {
    this.assertCustomer(user);
    return this.paymentsService.createCustomerWalletTopup(
      user.userId,
      dto.amountToman,
    );
  }

  private assertCustomer(user: TokenPayload) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('این کیف پول فقط برای مشتریان است');
    }
  }
}

@ApiTags('Payments')
@Controller('payments')
export class CustomerPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my service payments' })
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  listMyPayments(
    @CurrentUser() user: TokenPayload,
    @Query('page') pageText = '1',
    @Query('pageSize') pageSizeText = '20',
  ) {
    const page = Number(pageText);
    const pageSize = Number(pageSizeText);
    if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
      throw new BadRequestException('شماره صفحه معتبر نیست');
    }
    return this.paymentsService.listMyPayments(user.userId, page, pageSize);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or resume checkout for an accepted quote' })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/checkout')
  createCheckout(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.createCheckout(user.userId, requestId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status for a request I own' })
  @UseGuards(JwtAuthGuard)
  @Get('service-requests/:requestId')
  getPayment(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.getCustomerPayment(user.userId, requestId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm completed work and release provider earnings',
  })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/confirm-completion')
  confirmCompletion(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.confirmCompletion(user.userId, requestId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Raise a dispute before provider earnings are released',
  })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/dispute')
  raiseDispute(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.raiseDispute(user.userId, requestId);
  }

  @ApiOperation({
    summary: 'Verify Zarinpal callback and return to the website',
  })
  @Get('zarinpal/callback')
  @Redirect()
  async zarinpalCallback(
    @Query('Authority') authority?: string,
    @Query('Status') status?: string,
  ) {
    return {
      url: await this.paymentsService.handleCallback(authority, status),
      statusCode: 302,
    };
  }
}

@ApiTags('Admin - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({ summary: 'List payment records' })
  @Get()
  list(
    @Query('page') pageText = '1',
    @Query('pageSize') pageSizeText = '20',
    @Query('status') status?: string,
  ) {
    const page = Number(pageText);
    const pageSize = Number(pageSizeText);
    if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
      throw new BadRequestException('شماره صفحه معتبر نیست');
    }
    if (status && !['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(status)) {
      throw new BadRequestException('وضعیت پرداخت معتبر نیست');
    }
    return this.paymentsService.listPayments(page, pageSize, status);
  }
}
