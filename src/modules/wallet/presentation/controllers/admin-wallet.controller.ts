import {
  Body,
  ConflictException,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AdminGuard } from '../../../auth/presentation/guards/admin.guard';
import { CreditProviderWalletUseCase } from '../../application/credit-provider-wallet.use-case';
import { AdminCreditWalletDto } from '../../application/dto/admin-credit-wallet.dto';
import { WalletTransactionType } from '../../domain/entities/wallet-transaction-type';

@ApiTags('Admin - Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/wallets')
export class AdminWalletController {
  constructor(private readonly creditUseCase: CreditProviderWalletUseCase) {}

  @ApiOperation({ summary: 'Manually credit a provider wallet (adjustment)' })
  @Post(':providerProfileId/credit')
  async credit(
    @Param('providerProfileId') providerProfileId: string,
    @Body() dto: AdminCreditWalletDto,
  ) {
    const result = await this.creditUseCase.execute({
      providerProfileId,
      amount: dto.amount,
      type: WalletTransactionType.ADJUSTMENT,
      description: dto.description,
    });

    if (result.status !== 'CREDITED') {
      throw new ConflictException('Credit was not applied');
    }
    return result.transaction;
  }
}