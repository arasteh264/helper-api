// matching.module.ts
import { Module } from '@nestjs/common';
import { MatchProvidersForRequestUseCase } from './application/match-providers-for-request.use-case';
import { MATCHING_REPOSITORY } from './domain/matching.repository.token';
import { NOTIFICATION_PORT } from './domain/notification.port';
import { PrismaMatchingRepository } from './infrastructure/prisma-matching.repository';
import { LoggerNotificationAdapter } from './infrastructure/logger-notification.adapter';

@Module({
  providers: [
    MatchProvidersForRequestUseCase,
    { provide: MATCHING_REPOSITORY, useClass: PrismaMatchingRepository },
    { provide: NOTIFICATION_PORT, useClass: LoggerNotificationAdapter },
  ],
  exports: [MatchProvidersForRequestUseCase],
})
export class MatchingModule {}