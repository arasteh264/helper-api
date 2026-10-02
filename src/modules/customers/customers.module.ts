import { Module } from '@nestjs/common';
import { GetOrCreateCustomerProfileUseCase } from "./application/get-or-create-customer-profile.use-case";
import { CUSTOMER_PROFILE_REPOSITORY } from "./domain/repositories/customer-profile.repository.token";
import { PrismaCustomerProfileRepository } from "./infrastructure/repositories/prisma-customer-profile.repository";
import { CustomersController } from './presentation/customers.controller';
import { GetCustomerOverviewUseCase } from './application/get-customer-overview.use-case';
import { CUSTOMER_WALLET_REPOSITORY } from './domain/repositories/customer-wallet.repository.token';
import { CUSTOMER_OVERVIEW_READER } from './domain/repositories/customer-overview.reader.token';
import { PrismaCustomerWalletRepository } from './infrastructure/repositories/prisma-customer-wallet.repository';
import { PrismaCustomerOverviewReader } from './infrastructure/repositories/prisma-customer-overview.reader';
import { ServiceRequestsModule } from '../service-requests/service-requests.module';

@Module({
  imports: [ServiceRequestsModule],
  controllers: [CustomersController],
  providers: [
    GetOrCreateCustomerProfileUseCase,
    GetCustomerOverviewUseCase,
    { provide: CUSTOMER_PROFILE_REPOSITORY, useClass: PrismaCustomerProfileRepository },
    { provide: CUSTOMER_WALLET_REPOSITORY, useClass: PrismaCustomerWalletRepository },
    { provide: CUSTOMER_OVERVIEW_READER, useClass: PrismaCustomerOverviewReader },
  ],
  exports: [GetOrCreateCustomerProfileUseCase],
})
export class CustomersModule {}