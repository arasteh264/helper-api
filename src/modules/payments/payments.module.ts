import { Module } from '@nestjs/common';
import {
  AdminPaymentsController,
  CustomerWalletPaymentsController,
  CustomerPaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    CustomerPaymentsController,
    CustomerWalletPaymentsController,
    AdminPaymentsController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
