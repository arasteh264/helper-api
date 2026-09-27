import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { buildPaginatedResult } from '../../../../shared/utils/paginate.util';
import { PaginatedResult } from '../../../../shared/types/paginated-result.type';
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

    const [wallet] = await Promise.all([
      this.getOrCreateWallet(profile.id),
      this.ensureConfiguration(),
    ]);

    const pending = await this.prisma.payoutRequest.aggregate({
      where: { walletId: wallet.id, status: 'PENDING' },
      _sum: { amount: true },
    });
    const configuration = await this.ensureConfiguration();
    const currentMonth = new Date();
    const monthlyStart = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() - 5,
        1,
      ),
    );
    const earnings = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        type: WalletTransactionType.EARNING,
        createdAt: { gte: monthlyStart },
      },
      select: { amount: true, createdAt: true },
    });
    const monthlyTotals = new Map<string, number>();
    for (const earning of earnings) {
      const key = `${earning.createdAt.getUTCFullYear()}-${earning.createdAt.getUTCMonth()}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + earning.amount);
    }
    const monthFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'long',
      timeZone: 'UTC',
    });
    const monthly = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        Date.UTC(
          currentMonth.getUTCFullYear(),
          currentMonth.getUTCMonth() - 5 + index,
          15,
        ),
      );
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      return {
        label: monthFormatter.format(date),
        amount: monthlyTotals.get(key) ?? 0,
      };
    });

    return {
      id: wallet.id,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalWithdrawn: wallet.totalWithdrawn,
      pendingPayouts: pending._sum.amount ?? 0,
      commissionRate: configuration.commissionRate,
      minWithdrawal: configuration.minWithdrawal,
      monthly,
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

    const payoutIds = rows
      .map((row) => row.payoutRequestId)
      .filter((id): id is string => Boolean(id));
    const payouts = payoutIds.length
      ? await this.prisma.payoutRequest.findMany({
          where: { id: { in: payoutIds } },
          select: { id: true, status: true },
        })
      : [];
    const payoutStatuses = new Map(
      payouts.map((payout) => [payout.id, payout.status]),
    );

    return buildPaginatedResult(
      rows.map((row) =>
        this.toTransactionView({
          ...row,
          payoutStatus: row.payoutRequestId
            ? (payoutStatuses.get(row.payoutRequestId) ?? null)
            : null,
        }),
      ),
      total,
    );
  }

  async credit(input: CreditWalletInput): Promise<CreditResult> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: input.providerProfileId },
      select: { id: true },
    });
    if (!profile) return { status: 'PROVIDER_NOT_FOUND' };

    const wallet = await this.getOrCreateWallet(profile.id);

    try {
      const created = await this.prisma.$transaction(async (db) => {
        const settings = await db.walletConfiguration.findUniqueOrThrow({
          where: { id: 'global' },
        });
        const commission =
          input.type === WalletTransactionType.EARNING
            ? Math.round((input.amount * settings.commissionRate) / 100)
            : 0;
        const grossBalance = await db.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: input.amount },
            ...(input.type === WalletTransactionType.EARNING && {
              totalEarned: { increment: input.amount },
            }),
          },
        });

        const earning = await db.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: input.type,
            amount: input.amount,
            balanceAfter: grossBalance.balance,
            description: input.description ?? null,
            serviceRequestId: input.serviceRequestId ?? null,
          },
        });

        if (commission > 0) {
          const netBalance = await db.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: commission } },
          });
          await db.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: WalletTransactionType.COMMISSION,
              amount: -commission,
              balanceAfter: netBalance.balance,
              description: `Platform commission (${settings.commissionRate}%)`,
              serviceRequestId: input.serviceRequestId ?? null,
            },
          });
        }

        return earning;
      });

      return {
        status: 'CREDITED',
        transaction: this.toTransactionView(created),
      };
    } catch (error: any) {
      if (error?.code === 'P2002') return { status: 'DUPLICATE' };
      throw error;
    }
  }

  async findBankAccountByUserId(
    userId: string,
  ): Promise<BankAccountView | null> {
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

  async findBankAccountByProviderProfileId(
    providerProfileId: string,
  ): Promise<BankAccountView | null> {
    const account = await this.prisma.providerBankAccount.findUnique({
      where: { providerProfileId },
    });
    return account ? this.toBankView(account) : null;
  }

  async upsertBankAccountByProviderProfileId(
    providerProfileId: string,
    data: { holderName: string; sheba: string; bankName: string | null },
  ): Promise<BankAccountView | null> {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: { id: true },
    });
    if (!profile) return null;

    const account = await this.prisma.providerBankAccount.upsert({
      where: { providerProfileId },
      update: data,
      create: { providerProfileId, ...data },
    });
    return this.toBankView(account);
  }

  async getConfiguration() {
    const configuration = await this.ensureConfiguration();
    return {
      commissionRate: configuration.commissionRate,
      minWithdrawal: configuration.minWithdrawal,
    };
  }

  async updateCommissionRate(rate: number) {
    const configuration = await this.prisma.walletConfiguration.upsert({
      where: { id: 'global' },
      update: { commissionRate: rate },
      create: { id: 'global', commissionRate: rate },
    });
    return {
      commissionRate: configuration.commissionRate,
      minWithdrawal: configuration.minWithdrawal,
    };
  }

  async createPayoutRequest(userId: string, amount: number) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Provider profile not found');

    const [wallet, settings] = await Promise.all([
      this.getOrCreateWallet(profile.id),
      this.ensureConfiguration(),
    ]);

    return this.prisma.$transaction(async (db) => {
      const account = await db.providerBankAccount.findUnique({
        where: { providerProfileId: profile.id },
      });
      if (!account) throw new BadRequestException('Bank account is not set');

      const transactionSettings =
        await db.walletConfiguration.findUniqueOrThrow({
          where: { id: settings.id },
        });
      if (amount < transactionSettings.minWithdrawal) {
        throw new BadRequestException(
          `Minimum withdrawal is ${transactionSettings.minWithdrawal}`,
        );
      }

      const transactionWallet = await db.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      });
      const updated = await db.wallet.updateMany({
        where: { id: transactionWallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (updated.count === 0) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const updatedWallet = await db.wallet.findUniqueOrThrow({
        where: { id: transactionWallet.id },
        select: { balance: true },
      });
      const payout = await db.payoutRequest.create({
        data: {
          walletId: transactionWallet.id,
          amount,
          holderName: account.holderName,
          sheba: account.sheba,
          bankName: account.bankName,
        },
      });
      await db.walletTransaction.create({
        data: {
          walletId: transactionWallet.id,
          type: WalletTransactionType.PAYOUT_REQUEST,
          amount: -amount,
          balanceAfter: updatedWallet.balance,
          description: `Withdrawal to ${account.bankName ?? 'bank account'}`,
          payoutRequestId: payout.id,
        },
      });
      return payout;
    });
  }

  private async getOrCreateWallet(
    providerProfileId: string,
    client: Pick<PrismaService, 'wallet'> = this.prisma,
  ) {
    const existing = await client.wallet.findUnique({
      where: { providerProfileId },
    });
    if (existing) return existing;

    try {
      return await client.wallet.create({ data: { providerProfileId } });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const wallet = await client.wallet.findUnique({
        where: { providerProfileId },
      });
      if (wallet) return wallet;
      throw error;
    }
  }

  private async ensureConfiguration(
    client: Pick<PrismaService, 'walletConfiguration'> = this.prisma,
  ) {
    const existing = await client.walletConfiguration.findUnique({
      where: { id: 'global' },
    });
    if (existing) return existing;

    try {
      return await client.walletConfiguration.create({
        data: { id: 'global' },
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
      const configuration = await client.walletConfiguration.findUnique({
        where: { id: 'global' },
      });
      if (configuration) return configuration;
      throw error;
    }
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
    payoutStatus?: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED' | null;
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
      payoutStatus: r.payoutStatus ?? null,
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
