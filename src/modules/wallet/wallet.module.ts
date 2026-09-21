import { Module } from '@nestjs/common';
import { ProviderWalletController } from './presentation/controllers/provider-wallet.controller';
import { AdminWalletController } from './presentation/controllers/admin-wallet.controller';
import { GetWalletSummaryUseCase } from './application/get-wallet-summary.use-case';
import { ListWalletTransactionsUseCase } from './application/list-wallet-transactions.use-case';
import { GetBankAccountUseCase } from './application/get-bank-account.use-case';
import { UpsertBankAccountUseCase } from './application/upsert-bank-account.use-case';
import { CreditProviderWalletUseCase } from './application/credit-provider-wallet.use-case';
import { WALLET_REPOSITORY } from './domain/repositories/wallet.repository.token';
import { PrismaWalletRepository } from './infrastructure/repositories/prisma-wallet.repository';

@Module({
  controllers: [ProviderWalletController, AdminWalletController],
  providers: [
    GetWalletSummaryUseCase,
    ListWalletTransactionsUseCase,
    GetBankAccountUseCase,
    UpsertBankAccountUseCase,
    CreditProviderWalletUseCase,
    { provide: WALLET_REPOSITORY, useClass: PrismaWalletRepository },
  ],
  exports: [CreditProviderWalletUseCase],
})
export class WalletModule {}
