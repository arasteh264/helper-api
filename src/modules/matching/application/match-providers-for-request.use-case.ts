// application/match-providers-for-request.use-case.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { INITIAL_BATCH_SIZE } from '../matching.constants';
import { MATCHING_REPOSITORY } from '../domain/matching.repository.token';
import type { MatchingRepository } from '../domain/matching.repository';
import { rankCandidates } from '../domain/provider-ranking';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class MatchProvidersForRequestUseCase {
  private readonly logger = new Logger(MatchProvidersForRequestUseCase.name);

  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly repository: MatchingRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(requestId: string): Promise<void> {
    const criteria = await this.repository.getCriteria(requestId);
    if (!criteria) return;

    const candidates = await this.repository.findCandidates(
      requestId,
      criteria.specialtyId,
      criteria.skillIds,
    );
    const selected = rankCandidates(criteria, candidates, {
      batchSize: INITIAL_BATCH_SIZE,
    });

    await this.repository.createInvitations(requestId, selected);

    const pending = await this.repository.findUnnotified(requestId);
    for (const invitation of pending) {
      try {
        const distance =
          invitation.distanceKm === null
            ? 'فاصله نامشخص'
            : `حدود ${invitation.distanceKm} کیلومتر فاصله`;
        await this.notifications.createForUser({
          userId: invitation.providerUserId,
          category: 'OPPORTUNITIES',
          type: 'NEW_OPPORTUNITY',
          title: 'درخواست کاری جدید',
          body: `درخواست «${invitation.requestTitle}» برای تخصص شما ثبت شده است (${distance}).`,
          serviceRequestId: invitation.requestId,
        });
        await this.repository.markNotified(invitation.invitationId);
      } catch (error) {
        this.logger.error(
          `Notification failed for invitation ${invitation.invitationId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
