import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../../../auth/domain/services/token-generator.port';
import { ProviderJobsUseCase } from '../../application/provider-jobs.use-case';
import { AcceptServiceRequestDto } from '../../application/dto/accept-service-request.dto';
import { CreateServiceRequestDisputeMessageDto } from '../../../payments/dto/create-service-request-dispute-message.dto';
import { RaiseProviderNonPaymentDisputeDto } from '../../application/dto/raise-provider-non-payment-dispute.dto';

@ApiTags('Provider Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers/jobs')
export class ProviderJobsController {
  constructor(private readonly providerJobsUseCase: ProviderJobsUseCase) {}

  @ApiOperation({ summary: 'List jobs available to or assigned to me' })
  @Get()
  list(@CurrentUser() user: TokenPayload) {
    return this.providerJobsUseCase.list(user.userId);
  }

  @ApiOperation({ summary: 'Accept a service request' })
  @Post(':requestId/accept')
  accept(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: AcceptServiceRequestDto,
  ) {
    return this.providerJobsUseCase.accept(
      user.userId,
      requestId,
      dto.proposedPriceToman,
      dto.estimatedHours,
    );
  }

  @ApiOperation({ summary: 'Decline a service request for this provider' })
  @Post(':requestId/decline')
  decline(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.providerJobsUseCase.decline(user.userId, requestId);
  }

  @ApiOperation({ summary: 'Start an accepted job' })
  @Post(':requestId/start')
  start(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.providerJobsUseCase.start(user.userId, requestId);
  }

  @ApiOperation({ summary: 'Complete an in-progress job' })
  @Post(':requestId/complete')
  complete(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.providerJobsUseCase.complete(user.userId, requestId);
  }

  @ApiOperation({ summary: 'Reply to an active service dispute' })
  @Post(':requestId/dispute/messages')
  addDisputeMessage(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: CreateServiceRequestDisputeMessageDto,
  ) {
    return this.providerJobsUseCase.addDisputeMessage(
      user.userId,
      requestId,
      dto.body,
    );
  }

  @ApiOperation({ summary: 'Report a customer non-payment dispute' })
  @Post(':requestId/dispute')
  raiseNonPaymentDispute(
    @CurrentUser() user: TokenPayload,
    @Param('requestId') requestId: string,
    @Body() dto: RaiseProviderNonPaymentDisputeDto,
  ) {
    return this.providerJobsUseCase.raiseNonPaymentDispute(
      user.userId,
      requestId,
      dto.description,
    );
  }
}
