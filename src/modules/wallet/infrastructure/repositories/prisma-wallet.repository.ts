import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { buildPaginatedResult } from '@/shared/utils/paginate.util';
import { PaginatedResult } from '@/shared/types/paginated-result.type';
import { WalletTransactionType } from '../../domain/entities/wallet-transaction-type';
import type {
  BankAccountView,
  CreditResult,
  CreditWalletInput,
  ListWalletTransactionsFilter,
  WalletRepository,
  WalletSummary,
  WalletTransactionView,
} from '../../domain/repositories/wallet.repository';

@Injectable()
export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWalletByUserId(userId: string): Promise<WalletSummary | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return null;

    const wallet = await this.prisma.wallet.upsert({
      where: { providerProfileId: profile.id },
      update: {},
      create: { providerProfileId: profile.id },
    });

    const pending = await this.prisma.payoutRequest.aggregate({
      where: { walletId: wallet.id, status: 'PENDING' },
      _sum: { amount: true },
    });

    return {
      id: wallet.id,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      pendingPayouts: pending._sum.amount ?? 0,
    };
  }

  async listTransactions(
    userId: string,
    f: ListWalletTransactionsFilter,
  ): Promise<PaginatedResult<WalletTransactionView>> {
    const pageSize = Math.min(f.pageSize, 100);

    const where: any = {
      wallet: { providerProfile: { userId } },
    };

    if (f.type) where.type = f.type;
    if (f.direction === 'in') where.amount = { gt: 0 };
    if (f.direction === 'out') where.amount = { lt: 0 };
    if (f.search) {
      where.description = { contains: f.search, mode: 'insensitive' };
    }
    if (f.createdFrom || f.createdTo) {
      where.createdAt = {
        ...(f.createdFrom && { gte: f.createdFrom }),
        ...(f.createdTo && { lte: f.createdTo }),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: [{ createdAt: f.sortOrder }, { id: f.sortOrder }],
        skip: (f.page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return buildPaginatedResult(
      rows.map((r) => this.toTransactionView(r)),
      total,
    );
  }

  async credit(input: CreditWalletInput): Promise<CreditResult> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: input.providerProfileId },
      select: { id: true },
    });
    if (!profile) return { status: 'PROVIDER_NOT_FOUND' };

    try {
      const created = await this.prisma.$transaction(async (db) => {
        const wallet = await db.wallet.upsert({
          where: { providerProfileId: profile.id },
          update: {},
          create: { providerProfileId: profile.id },
        });

        const updated = await db.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: input.amount },
            ...(input.type === WalletTransactionType.EARNING && {
              totalEarned: { increment: input.amount },
            }),
          },
        });

        return db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: input.type,
            amount: input.amount,
            balanceAfter: updated.balance,
            description: input.description ?? null,
            serviceRequestId: input.serviceRequestId ?? null,
          },
        });
      });

      return { status: 'CREDITED', transaction: this.toTransactionView(created) };
    } catch (error: any) {
      if (error?.code === 'P2002') return { status: 'DUPLICATE' };
      throw error;
    }
  }

  async findBankAccountByUserId(userId: string): Promise<BankAccountView | null> {
    const account = await this.prisma.providerBankAccount.findFirst({
      where: { providerProfile: { userId } },
    });
    return account ? this.toBankView(account) : null;
  }

  async upsertBankAccount(
    userId: string,
    data: { holderName: string; sheba: string; bankName: string | null },
  ): Promise<BankAccountView | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return null;

    const account = await this.prisma.providerBankAccount.upsert({
      where: { providerProfileId: profile.id },
      update: data,
      create: { providerProfileId: profile.id, ...data },
    });
    return this.toBankView(account);
  }

  private toTransactionView(r: {
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    serviceRequestId: string | null;
    payoutRequestId: string | null;
    createdAt: Date;
  }): WalletTransactionView {
    return {
      id: r.id,
      type: r.type as WalletTransactionType,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      description: r.description,
      serviceRequestId: r.serviceRequestId,
      payoutRequestId: r.payoutRequestId,
      createdAt: r.createdAt,
    };
  }

  private toBankView(a: {
    holderName: string;
    sheba: string;
    bankName: string | null;
    updatedAt: Date;
  }): BankAccountView {
    return {
      holderName: a.holderName,
      sheba: a.sheba,
      bankName: a.bankName,
      updatedAt: a.updatedAt,
    };
  }
}