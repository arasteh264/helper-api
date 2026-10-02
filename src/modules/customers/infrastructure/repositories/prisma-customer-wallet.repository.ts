// infrastructure/repositories/prisma-customer-wallet.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CustomerWallet } from '../../domain/entities/customer-wallet.entity';
import type { CustomerWalletRepository } from '../../domain/repositories/customer-wallet.repository';

@Injectable()
export class PrismaCustomerWalletRepository implements CustomerWalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(customerProfileId: string): Promise<CustomerWallet> {
    const row = await this.prisma.customerWallet.upsert({
      where: { customerProfileId },
      update: {},
      create: { customerProfileId },
    });
    return CustomerWallet.reconstitute(row);
  }
}