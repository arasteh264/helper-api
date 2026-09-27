import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { GetWalletSummaryUseCase } from '../../application/get-wallet-summary.use-case';
import { ListWalletTransactionsUseCase } from '../../application/list-wallet-transactions.use-case';
import { GetBankAccountUseCase } from '../../application/get-bank-account.use-case';
import { ListWalletTransactionsQueryDto } from '../../application/dto/list-wallet-transactions-query.dto';
import { CreatePayoutRequestUseCase } from '../../application/create-payout-request.use-case';
import { CreatePayoutRequestDto } from '../../application/dto/create-payout-request.dto';

@ApiTags('Provider Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers/wallet')
export class ProviderWalletController {
  constructor(
    private readonly getSummaryUseCase: GetWalletSummaryUseCase,
    private readonly listTransactionsUseCase: ListWalletTransactionsUseCase,
    private readonly getBankAccountUseCase: GetBankAccountUseCase,
    private readonly createPayoutRequestUseCase: CreatePayoutRequestUseCase,
  ) {}

  @ApiOperation({
    summary: 'My wallet summary (balance, totals, pending payouts)',
  })
  @Get()
  getSummary(@CurrentUser() user: TokenPayload) {
    return this.getSummaryUseCase.execute(user.userId);
  }

  @ApiOperation({ summary: 'My wallet transactions (paginated, filterable)' })
  @Get('transactions')
  listTransactions(
    @CurrentUser() user: TokenPayload,
    @Query() q: ListWalletTransactionsQueryDto,
  ) {
    return this.listTransactionsUseCase.execute(user.userId, {
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 10,
      search: q.search,
      type: q.type,
      direction: q.direction,
      createdFrom: q.createdFrom,
      createdTo: q.createdTo,
      sortOrder: q.sortOrder ?? 'desc',
    });
  }

  @ApiOperation({ summary: 'Get my payout bank account' })
  @Get('bank-account')
  getBankAccount(@CurrentUser() user: TokenPayload) {
    return this.getBankAccountUseCase.execute(user.userId);
  }

  @ApiOperation({ summary: 'Request a wallet withdrawal' })
  @Post('payouts')
  createPayoutRequest(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreatePayoutRequestDto,
  ) {
    return this.createPayoutRequestUseCase.execute(user.userId, dto.amount);
  }
}
