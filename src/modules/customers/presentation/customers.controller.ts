import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { GetCustomerOverviewUseCase } from '../application/get-customer-overview.use-case';

@ApiTags('customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customer')
export class CustomersController {
  constructor(private readonly getOverview: GetCustomerOverviewUseCase) {}

  @Get('profile')
  @ApiOperation({ summary: 'Customer profile with wallet and request stats' })
  profile(@CurrentUser() user: { userId: string }) {
    return this.getOverview.execute(user.userId);
  }
}