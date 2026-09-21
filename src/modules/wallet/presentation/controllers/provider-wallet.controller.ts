import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { GetWalletSummaryUseCase } from '../../application/get-wallet-summary.use-case';
import { ListWalletTransactionsUseCase } from '../../application/list-wallet-transactions.use-case';
import { GetBankAccountUseCase } from '../../application/get-bank-account.use-case';
import { UpsertBankAccountUseCase } from '../../application/upsert-bank-account.use-case';
import { ListWalletTransactionsQueryDto } from '../../application/dto/list-wallet-transactions-query.dto';
import { UpsertBankAccountDto } from '../../application/dto/upsert-bank-account.dto';

@ApiTags('Provider Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers/wallet')
export class ProviderWalletController {
  constructor(
    private readonly getSummaryUseCase: GetWalletSummaryUseCase,
    private readonly listTransactionsUseCase: ListWalletTransactionsUseCase,
    private readonly getBankAccountUseCase: GetBankAccountUseCase,
    private readonly upsertBankAccountUseCase: UpsertBankAccountUseCase,
  ) {}

  @ApiOperation({ summary: 'My wallet summary (balance, totals, pending payouts)' })
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

  @ApiOperation({ summary: 'Set or update my payout bank account' })
  @Put('bank-account')
  upsertBankAccount(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpsertBankAccountDto,
  ) {
    return this.upsertBankAccountUseCase.execute(user.userId, dto);
  }
}