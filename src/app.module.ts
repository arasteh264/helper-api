import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';

@Module({
  imports: [DatabaseModule, UsersModule, AuthModule, ProvidersModule,ServiceRequestsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
