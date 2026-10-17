import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { ProviderReferralsService } from '../../application/provider-referrals.service';

@ApiTags('Provider Referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers/referrals')
export class ProviderReferralsController {
  constructor(
    private readonly providerReferralsService: ProviderReferralsService,
  ) {}

  @ApiOperation({ summary: 'Get my referral code and referral rewards' })
  @Get()
  getDashboard(@CurrentUser() user: TokenPayload) {
    return this.providerReferralsService.getDashboard(user.userId);
  }

  @ApiOperation({ summary: 'Create or retrieve my provider referral code' })
  @Post('code')
  createCode(@CurrentUser() user: TokenPayload) {
    return this.providerReferralsService.createOrGetCode(user.userId);
  }
}
