import {
  Body,
  Controller,
  ForbiddenException,
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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @ApiOperation({
    summary: 'Create an invoice for an assigned service request',
  })
  @Post('provider/service-requests/:serviceRequestId/invoice')
  create(
    @CurrentUser() user: TokenPayload,
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    if (user.role !== 'PROVIDER') {
      throw new ForbiddenException('صدور فاکتور فقط برای متخصص مجاز است');
    }
    return this.invoices.createForRequest(user.userId, serviceRequestId, dto);
  }

  @ApiOperation({ summary: 'Get my invoice for a service request' })
  @Get('provider/service-requests/:serviceRequestId/invoice')
  getProviderInvoice(
    @CurrentUser() user: TokenPayload,
    @Param('serviceRequestId', ParseUUIDPipe) serviceRequestId: string,
  ) {
    if (user.role !== 'PROVIDER') {
      throw new ForbiddenException(
        'فقط متخصص می‌تواند فاکتور خود را مشاهده کند',
      );
    }
    return this.invoices.getForProviderRequest(user.userId, serviceRequestId);
  }

  @ApiOperation({ summary: 'Send a draft invoice to its customer' })
  @Post('provider/invoices/:invoiceId/send')
  send(
    @CurrentUser() user: TokenPayload,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (user.role !== 'PROVIDER') {
      throw new ForbiddenException('ارسال فاکتور فقط برای متخصص مجاز است');
    }
    return this.invoices.sendToCustomer(user.userId, invoiceId);
  }

  @ApiOperation({ summary: 'List invoices sent to me' })
  @Get('invoices/mine')
  listMine(@CurrentUser() user: TokenPayload) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('فقط مشتری می‌تواند فاکتورهای خود را ببیند');
    }
    return this.invoices.listForCustomer(user.userId);
  }

  @ApiOperation({ summary: 'Get a sent invoice belonging to me' })
  @Get('invoices/:invoiceId')
  getCustomerInvoice(
    @CurrentUser() user: TokenPayload,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (user.role !== 'CUSTOMER') {
      throw new ForbiddenException('فقط مشتری می‌تواند فاکتور خود را ببیند');
    }
    return this.invoices.getForCustomer(user.userId, invoiceId);
  }
}
