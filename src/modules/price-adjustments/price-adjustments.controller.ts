import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/presentation/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/presentation/guards/jwt-auth.guard';
import type { TokenPayload } from '../auth/domain/services/token-generator.port';
import { PaymentsService } from '../payments/payments.service';
import { CreatePriceAdjustmentDto } from './dto/create-price-adjustment.dto';
import { PriceAdjustmentsService } from './price-adjustments.service';

@ApiTags('Service price adjustments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PriceAdjustmentsController {
  constructor(
    private readonly adjustments: PriceAdjustmentsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get('service-requests/:requestId/price-adjustments')
  @ApiOperation({ summary: 'List adjustments for a request I participate in' })
  list(
    @CurrentUser() user: TokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.adjustments.listForRequest(user.userId, requestId);
  }

  @Post('service-requests/:requestId/price-adjustments')
  @ApiOperation({ summary: 'Propose an increase to an in-progress service' })
  create(
    @CurrentUser() user: TokenPayload,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: CreatePriceAdjustmentDto,
  ) {
    return this.adjustments.createForProvider(user.userId, requestId, dto);
  }

  @Post('price-adjustments/:adjustmentId/reject')
  @ApiOperation({ summary: 'Reject a pending price adjustment' })
  reject(
    @CurrentUser() user: TokenPayload,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
  ) {
    return this.adjustments.rejectByCustomer(user.userId, adjustmentId);
  }

  @Post('price-adjustments/:adjustmentId/approve')
  @ApiOperation({ summary: 'Approve an adjustment and pay its difference' })
  async approve(
    @CurrentUser() user: TokenPayload,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
  ) {
    await this.adjustments.approveForCheckout(user.userId, adjustmentId);
    return this.payments.createPriceAdjustmentCheckout(
      user.userId,
      adjustmentId,
    );
  }
}
