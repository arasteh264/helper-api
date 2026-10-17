import { IsIn } from 'class-validator';
import type { ProviderReferralRewardType } from '../../../../../generated/prisma/client';

export class GrantProviderReferralRewardDto {
  @IsIn(['STORY_PUBLISHING', 'ARTICLE_PUBLISHING', 'ZERO_COMMISSION'])
  rewardType!: ProviderReferralRewardType;
}
