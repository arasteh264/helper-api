import { Module } from '@nestjs/common';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminOperationsController } from './admin-operations.controller';

@Module({
  controllers: [AdminAccountsController, AdminOperationsController],
})
export class AdminModule {}
