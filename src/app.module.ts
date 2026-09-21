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

@Module({
  imports: [DatabaseModule, StorageModule, UsersModule, AuthModule, ProvidersModule,ServiceRequestsModule,WalletModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
