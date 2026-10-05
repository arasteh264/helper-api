import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';

import { PROVIDER_PROFILE_REPOSITORY } from '../../domain/repositories/provider-profile.repository.token';
import type { ProviderProfileRepository } from '../../domain/repositories/provider-profile.repository';
import { PROVIDER_DOCUMENT_REPOSITORY } from '../../application/documents/provider-document.repository.token';
import type { ProviderDocumentRepository } from '../../application/documents/provider-document.repository';

import { ProviderProfileDetailsResponseDto } from '../../application/dto/provider-profile-details-response.dto';
import { AdminPendingProvidersQueryDto } from '../../application/dto/admin-pending-providers-query.dto';
import { GetProviderDocumentsForReviewUseCase } from '../../application/documents/get-provider-documents-for-review.use-case';
import { ReviewProviderDto } from '../../application/dto/review-provider-document.dto';
import { ReviewProviderDocumentUseCase } from '../../application/documents/review-provider-document.use-case';
import { areRequiredDocumentsApproved } from '../../infrastructure/provider-documents.util';
import { ReviewProviderDocumentDto } from '../../application/documents/review-provider-document.dto';

@ApiTags('Admin - Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/providers')
export class AdminProviderController {
  constructor(
    @Inject(PROVIDER_PROFILE_REPOSITORY)
    private readonly providerProfileRepository: ProviderProfileRepository,
    @Inject(PROVIDER_DOCUMENT_REPOSITORY)
    private readonly providerDocumentRepository: ProviderDocumentRepository,
    private readonly getProviderDocumentsForReviewUseCase: GetProviderDocumentsForReviewUseCase,
    private readonly reviewProviderDocumentUseCase: ReviewProviderDocumentUseCase,
  ) {}

  @ApiOperation({ summary: 'List all provider profiles pending review' })
  @Get('pending')
  async listPending(
    @CurrentUser() _currentUser: TokenPayload,
    @Query() query: AdminPendingProvidersQueryDto,
  ) {
    const { items, total } =
      await this.providerProfileRepository.findPendingDetailsPage({
        skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 10),
        take: query.pageSize ?? 10,
        search: query.search?.trim() || undefined,
        isAvailable:
          query.available === undefined
            ? undefined
            : query.available === 'true',
      });

    return {
      items: items.map((provider) =>
        ProviderProfileDetailsResponseDto.from(provider),
      ),
      total,
    };
  }

  @ApiOperation({ summary: 'Review a provider registration' })
  @Patch(':providerId/review')
  async review(
    @CurrentUser() _currentUser: TokenPayload,
    @Param('providerId') providerId: string,
    @Body() dto: ReviewProviderDto,
  ) {
    const profile = await this.providerProfileRepository.findById(providerId);
    if (!profile) throw new NotFoundException('Provider profile not found');

    if (dto.status === 'APPROVED') {
      const documents =
        await this.providerDocumentRepository.findByProviderProfileId(
          providerId,
        );

      if (!areRequiredDocumentsApproved(documents)) {
        throw new BadRequestException(
          'همه‌ی مدارک اجباری باید قبل از تأیید نهایی، تأیید شده باشن',
        );
      }
    }

    profile.reviewDecision(dto.status, dto.note);
    await this.providerProfileRepository.update(profile);

    const details = await this.providerProfileRepository.findDetailsByUserId(
      profile.userId,
    );

    return ProviderProfileDetailsResponseDto.from(details!);
  }

  @ApiOperation({ summary: 'Get all verification documents of a provider' })
  @Get(':providerProfileId/documents')
  getDocuments(@Param('providerProfileId') providerProfileId: string) {
    return this.getProviderDocumentsForReviewUseCase.execute(providerProfileId);
  }

  @ApiOperation({ summary: 'Approve or reject a verification document' })
  @Patch('documents/:documentId/review')
  reviewDocument(
    @Param('documentId') documentId: string,
    @Body() dto: ReviewProviderDocumentDto,
  ) {
    return this.reviewProviderDocumentUseCase.execute(
      documentId,
      dto.decision,
      dto.rejectionNote,
    );
  }
}
