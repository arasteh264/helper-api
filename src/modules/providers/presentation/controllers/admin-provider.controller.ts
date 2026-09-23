import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { Inject } from '@nestjs/common';
import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { ProviderProfileDetailsResponseDto } from '../../application/dto/provider-profile-details-response.dto';

class ReviewProviderDto {
  status!: 'APPROVED' | 'REJECTED';
  note?: string;
}

@ApiTags('Admin - Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/providers')
export class AdminProviderController {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
  ) {}

  @ApiOperation({ summary: 'List all provider profiles pending review' })
  @Get('pending')
  async listPending(@CurrentUser() _currentUser: TokenPayload) {
    const providers = await this.providerProfileRepository.findAllApproved();
    return providers.map((profile) => {
      const details = this.providerProfileRepository.findDetailsByUserId(
        profile.userId,
      );
      return details;
    });
  }

  @ApiOperation({ summary: 'Review a provider registration' })
  @Patch(':providerId/review')
  async review(
    @CurrentUser() _currentUser: TokenPayload,
    @Param('providerId') providerId: string,
    @Body() dto: ReviewProviderDto,
  ) {
    const profile = await this.providerProfileRepository.findById(providerId);
    if (!profile) {
      throw new Error('Provider profile not found');
    }

    profile.reviewDecision(dto.status, dto.note);
    await this.providerProfileRepository.update(profile);

    const details = await this.providerProfileRepository.findDetailsByUserId(
      profile.userId,
    );
    return ProviderProfileDetailsResponseDto.from(details!);
  }
}
