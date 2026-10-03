import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CreditProviderWalletUseCase } from '../../application/credit-provider-wallet.use-case';
import { AdminCreditWalletDto } from '../../application/dto/admin-credit-wallet.dto';
import { WalletTransactionType } from '../../domain/entities/wallet-transaction-type';
import { GetBankAccountUseCase } from '../../application/get-bank-account.use-case';
import { UpsertBankAccountUseCase } from '../../application/upsert-bank-account.use-case';
import { UpsertBankAccountDto } from '../../application/dto/upsert-bank-account.dto';
import {
  GetWalletConfigurationUseCase,
  UpdateWalletCommissionRateUseCase,
} from '../../application/wallet-configuration.use-cases';
import { UpdateCommissionRateDto } from '../../application/dto/update-commission-rate.dto';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { ReviewPayoutRequestDto } from '../../application/dto/review-payout-request.dto';
import { ListPayoutRequestsQueryDto } from '../../application/dto/list-payout-requests-query.dto';
import { ListWalletTransactionsQueryDto } from '../../application/dto/list-wallet-transactions-query.dto';
import {
  GetPlatformAccountingSummaryUseCase,
  ListPlatformWalletTransactionsUseCase,
  ListPayoutRequestsUseCase,
  ReviewPayoutRequestUseCase,
} from '../../application/admin-wallet-accounting.use-cases';

@ApiTags('Admin - Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/wallets')
export class AdminWalletController {
  constructor(
    private readonly creditUseCase: CreditProviderWalletUseCase,
    private readonly getBankAccountUseCase: GetBankAccountUseCase,
    private readonly upsertBankAccountUseCase: UpsertBankAccountUseCase,
    private readonly getWalletConfigurationUseCase: GetWalletConfigurationUseCase,
    private readonly updateWalletCommissionRateUseCase: UpdateWalletCommissionRateUseCase,
    private readonly getAccountingSummaryUseCase: GetPlatformAccountingSummaryUseCase,
    private readonly listPayoutRequestsUseCase: ListPayoutRequestsUseCase,
    private readonly listPlatformWalletTransactionsUseCase: ListPlatformWalletTransactionsUseCase,
    private readonly reviewPayoutRequestUseCase: ReviewPayoutRequestUseCase,
  ) {}

  @ApiOperation({ summary: 'Get platform wallet configuration' })
  @Get('configuration')
  getConfiguration() {
    return this.getWalletConfigurationUseCase.execute();
  }

  @ApiOperation({ summary: 'Update platform commission rate' })
  @Put('configuration/commission')
  updateCommissionRate(@Body() dto: UpdateCommissionRateDto) {
    return this.updateWalletCommissionRateUseCase.execute(dto.commissionRate);
  }

  @ApiOperation({ summary: 'Get platform accounting summary' })
  @Get('accounting')
  getAccountingSummary() {
    return this.getAccountingSummaryUseCase.execute();
  }

  @ApiOperation({
    summary: 'List and filter provider wallet ledger transactions',
  })
  @Get('transactions')
  listTransactions(@Query() query: ListWalletTransactionsQueryDto) {
    return this.listPlatformWalletTransactionsUseCase.execute(
      query.page ?? 1,
      query.pageSize ?? 20,
      {
        type: query.type,
        direction: query.direction,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
      },
    );
  }

  @ApiOperation({ summary: 'List and filter provider payout requests' })
  @Get('payouts')
  listPayoutRequests(@Query() query: ListPayoutRequestsQueryDto) {
    return this.listPayoutRequestsUseCase.execute(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.status,
    );
  }

  @ApiOperation({ summary: 'Record payment or reject a provider payout' })
  @Patch('payouts/:payoutRequestId/review')
  reviewPayoutRequest(
    @CurrentUser() admin: TokenPayload,
    @Param('payoutRequestId') payoutRequestId: string,
    @Body() dto: ReviewPayoutRequestDto,
  ) {
    return this.reviewPayoutRequestUseCase.execute(
      payoutRequestId,
      admin.userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get provider payout bank account' })
  @Get(':providerProfileId/bank-account')
  getProviderBankAccount(
    @Param('providerProfileId') providerProfileId: string,
  ) {
    return this.getBankAccountUseCase.executeForProviderProfile(
      providerProfileId,
    );
  }

  @ApiOperation({ summary: 'Set or update provider payout bank account' })
  @Put(':providerProfileId/bank-account')
  updateProviderBankAccount(
    @Param('providerProfileId') providerProfileId: string,
    @Body() dto: UpsertBankAccountDto,
  ) {
    return this.upsertBankAccountUseCase.executeForProviderProfile(
      providerProfileId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Manually credit a provider wallet (adjustment)' })
  @Post(':providerProfileId/credit')
  async credit(
    @Param('providerProfileId') providerProfileId: string,
    @Body() dto: AdminCreditWalletDto,
  ) {
    const result = await this.creditUseCase.execute({
      providerProfileId,
      amount: dto.amount,
      type: WalletTransactionType.ADJUSTMENT,
      description: dto.description,
    });

    if (result.status !== 'CREDITED') {
      throw new ConflictException('Credit was not applied');
    }
    return result.transaction;
  }
}
