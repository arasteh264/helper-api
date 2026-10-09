import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';
import { StorageModule } from './shared/storage/storage.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SpecialtiesModule } from './modules/specialties/specialties.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ChatModule } from './modules/chat/chat.module';
import { BlogModule } from './modules/blog/blog.module';
import { AdminModule } from './modules/admin/admin.module';
import { RedisModule } from './infrastructure/cache/redis.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    StorageModule,
    UsersModule,
    AuthModule,
    ProvidersModule,
    ServiceRequestsModule,
    WalletModule,
    CustomersModule,
    SpecialtiesModule,
    PaymentsModule,
    ChatModule,
    BlogModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
