// application/match-providers-for-request.use-case.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { INITIAL_BATCH_SIZE, MAX_RADIUS_KM } from '../matching.constants';
import { MATCHING_REPOSITORY } from '../domain/matching.repository.token';
import type { MatchingRepository } from '../domain/matching.repository';
import { NOTIFICATION_PORT } from '../domain/notification.port';
import type { NotificationPort } from '../domain/notification.port';
import { rankCandidates } from '../domain/provider-ranking';

@Injectable()
export class MatchProvidersForRequestUseCase {
  private readonly logger = new Logger(MatchProvidersForRequestUseCase.name);

  constructor(
    @Inject(MATCHING_REPOSITORY)
    private readonly repository: MatchingRepository,
    @Inject(NOTIFICATION_PORT)
    private readonly notifier: NotificationPort,
  ) {}

  async execute(requestId: string): Promise<void> {
    const criteria = await this.repository.getCriteria(requestId);
    if (!criteria) return;

    const candidates = await this.repository.findCandidates(
      requestId,
      criteria.skillIds,
    );
    const selected = rankCandidates(criteria, candidates, {
      batchSize: INITIAL_BATCH_SIZE,
      maxRadiusKm: MAX_RADIUS_KM,
    });

    await this.repository.createInvitations(requestId, selected);

    const pending = await this.repository.findUnnotified(requestId);
    for (const invitation of pending) {
      try {
        await this.notifier.notifyNewRequest({
          phone: invitation.providerPhone,
          distanceKm: invitation.distanceKm,
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