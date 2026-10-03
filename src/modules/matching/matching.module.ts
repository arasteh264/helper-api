// matching.module.ts
import { Module } from '@nestjs/common';
import { MatchProvidersForRequestUseCase } from './application/match-providers-for-request.use-case';
import { MATCHING_REPOSITORY } from './domain/matching.repository.token';
import { PrismaMatchingRepository } from './infrastructure/prisma-matching.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    MatchProvidersForRequestUseCase,
    { provide: MATCHING_REPOSITORY, useClass: PrismaMatchingRepository },
  ],
  exports: [MatchProvidersForRequestUseCase],
})
export class MatchingModule {}
