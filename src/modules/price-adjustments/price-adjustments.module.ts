import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PriceAdjustmentsController } from './price-adjustments.controller';
import { PriceAdjustmentsService } from './price-adjustments.service';

@Module({
  imports: [PaymentsModule],
  controllers: [PriceAdjustmentsController],
  providers: [PriceAdjustmentsService],
})
export class PriceAdjustmentsModule {}
