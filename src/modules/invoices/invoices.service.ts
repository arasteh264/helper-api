import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PRISMA_SERVICE } from '../../infrastructure/database/prisma.service.token';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

const INVOICE_FIELDS = {
  id: true,
  serviceRequestId: true,
  customerId: true,
  providerProfileId: true,
  items: true,
  totalToman: true,
  status: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
  serviceRequest: { select: { id: true, title: true } },
  customer: { select: { id: true, name: true } },
  providerProfile: { select: { user: { select: { id: true, name: true } } } },
} satisfies Prisma.InvoiceSelect;

function prismaCode(error: unknown): string | undefined {
  return (error as { code?: string })?.code;
}

function containsContactInformation(value: string) {
  const normalized = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) ||
    /(?:\+?\d[\s().-]*){9,}/.test(normalized)
  );
}

@Injectable()
export class InvoicesService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async createForRequest(
    userId: string,
    serviceRequestId: string,
    input: CreateInvoiceDto,
  ) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) {
      throw new ForbiddenException(
        'برای صدور فاکتور به پروفایل متخصص نیاز است',
      );
    }
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: {
        id: true,
        customerId: true,
        acceptedProviderProfileId: true,
      },
    });
    if (!request) throw new NotFoundException('درخواست پیدا نشد');
    if (request.acceptedProviderProfileId !== provider.id) {
      throw new ForbiddenException(
        'فقط متخصص تخصیص‌یافته به درخواست می‌تواند فاکتور صادر کند',
      );
    }
    const items = this.calculateItems(input);
    const totalToman = items.reduce((sum, item) => sum + item.amountToman, 0);
    if (!Number.isSafeInteger(totalToman)) {
      throw new BadRequestException('مجموع فاکتور از محدوده مجاز بیشتر است');
    }
    try {
      return await this.prisma.invoice.create({
        data: {
          serviceRequestId: request.id,
          customerId: request.customerId,
          providerProfileId: provider.id,
          items: items as unknown as Prisma.InputJsonValue,
          totalToman,
        },
        select: INVOICE_FIELDS,
      });
    } catch (error) {
      if (prismaCode(error) === 'P2002') {
        throw new ConflictException(
          'برای این درخواست قبلاً فاکتور صادر شده است',
        );
      }
      throw error;
    }
  }

  async getForProviderRequest(userId: string, serviceRequestId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) {
      throw new ForbiddenException(
        'فقط متخصص می‌تواند فاکتور خود را مشاهده کند',
      );
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: { serviceRequestId, providerProfileId: provider.id },
      select: INVOICE_FIELDS,
    });
    if (!invoice) throw new NotFoundException('فاکتور پیدا نشد');
    return invoice;
  }

  async sendToCustomer(userId: string, invoiceId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!provider) {
      throw new ForbiddenException('فقط متخصص می‌تواند فاکتور ارسال کند');
    }
    const existing = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, providerProfileId: provider.id },
      select: {
        id: true,
        serviceRequestId: true,
        customerId: true,
        status: true,
      },
    });
    if (!existing) throw new NotFoundException('فاکتور پیدا نشد');
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('این فاکتور قبلاً به مشتری ارسال شده است');
    }

    return this.prisma.$transaction(async (transaction) => {
      const sentAt = new Date();
      const result = await transaction.invoice.updateMany({
        where: {
          id: existing.id,
          providerProfileId: provider.id,
          status: 'DRAFT',
        },
        data: { status: 'SENT', sentAt },
      });
      if (!result.count) {
        throw new ConflictException('این فاکتور قبلاً به مشتری ارسال شده است');
      }
      const invoice = await transaction.invoice.findUniqueOrThrow({
        where: { id: existing.id },
        select: INVOICE_FIELDS,
      });
      const notification = await transaction.notification.create({
        data: {
          userId: existing.customerId,
          category: 'PAYMENTS',
          type: 'PAYMENT_UPDATE',
          title: 'فاکتور جدید برای درخواست شما',
          body: 'فاکتور جدید برای درخواست شما آماده مشاهده است.',
          serviceRequestId: existing.serviceRequestId,
          invoiceId: existing.id,
        },
        select: { id: true, createdAt: true },
      });
      return { invoice, notification };
    });
  }

  async getForCustomer(userId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, customerId: userId, status: 'SENT' },
      select: INVOICE_FIELDS,
    });
    if (!invoice) throw new NotFoundException('فاکتور پیدا نشد');
    return invoice;
  }

  async listForCustomer(userId: string) {
    const items = await this.prisma.invoice.findMany({
      where: { customerId: userId, status: 'SENT' },
      select: INVOICE_FIELDS,
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
    });
    return { items };
  }

  private calculateItems(input: CreateInvoiceDto) {
    return input.items.map((item) => {
      const description = item.description.trim();
      if (!description) {
        throw new BadRequestException('شرح هر ردیف فاکتور الزامی است');
      }
      if (containsContactInformation(description)) {
        throw new BadRequestException(
          'ثبت شماره تماس یا ایمیل در شرح فاکتور مجاز نیست',
        );
      }
      const amountToman = item.quantity * item.unitPriceToman;
      if (!Number.isSafeInteger(amountToman)) {
        throw new BadRequestException('مبلغ ردیف فاکتور معتبر نیست');
      }
      return {
        description,
        quantity: item.quantity,
        unitPriceToman: item.unitPriceToman,
        amountToman,
      };
    });
  }
}
