import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
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
import { RaiseServiceRequestDisputeDto } from './dto/raise-service-request-dispute.dto';
import { CreateServiceRequestDisputeMessageDto } from './dto/create-service-request-dispute-message.dto';

@ApiTags('Customer Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer/wallet')
export class CustomerWalletPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my customer wallet balance and top-ups' })
  getWallet(@CurrentUser() user: TokenPayload) {
    this.assertWalletOwner(user);
    return this.paymentsService.getCustomerWallet(user.userId);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Start a customer wallet top-up through Zarinpal' })
  createTopup(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateCustomerWalletTopupDto,
  ) {
    this.assertWalletOwner(user);
    return this.paymentsService.createCustomerWalletTopup(
      user.userId,
      dto.amountToman,
    );
  }

  private assertWalletOwner(user: TokenPayload) {
    if (user.role !== 'CUSTOMER' && user.role !== 'PROVIDER') {
      throw new ForbiddenException('این کیف پول برای خریداران خدمات است');
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
  @ApiOperation({ summary: 'Pay for an accepted request from my wallet' })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/wallet')
  payFromWallet(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.payFromWallet(user.userId, requestId);
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
    summary: 'Retry verification of my pending Zarinpal service payment',
  })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/verify')
  verifyPayment(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.verifyCustomerPayment(user.userId, requestId);
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
    summary: 'Withdraw a customer dispute and confirm completed work',
  })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/confirm-disputed-completion')
  confirmDisputedCompletion(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.paymentsService.confirmDisputedCompletion(
      user.userId,
      requestId,
    );
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
    @Body() dto: RaiseServiceRequestDisputeDto,
  ) {
    return this.paymentsService.raiseDispute(
      user.userId,
      requestId,
      dto.reason,
      dto.description,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit an active customer dispute' })
  @UseGuards(JwtAuthGuard)
  @Patch('service-requests/:requestId/dispute')
  updateDispute(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: RaiseServiceRequestDisputeDto,
  ) {
    return this.paymentsService.updateDispute(
      user.userId,
      requestId,
      dto.reason,
      dto.description,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a message to an active service dispute' })
  @UseGuards(JwtAuthGuard)
  @Post('service-requests/:requestId/dispute/messages')
  addDisputeMessage(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: CreateServiceRequestDisputeMessageDto,
  ) {
    return this.paymentsService.addDisputeMessage(
      user.userId,
      requestId,
      dto.body,
    );
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

  @ApiOperation({
    summary: 'Get payment processing details for administrator review',
  })
  @Get(':paymentId')
  getDetails(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getAdminPaymentDetails(paymentId);
  }
}
