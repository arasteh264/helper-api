import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';
import { buildPaginatedResult } from '../../../../shared/utils/paginate.util';
import { PaginatedResult } from '../../../../shared/types/paginated-result.type';
import { WalletTransactionType } from '../../domain/entities/wallet-transaction-type';
import type {
  BankAccountView,
  CreditResult,
  CreditWalletInput,
  ListWalletTransactionsFilter,
  PayoutRequestView,
  PayoutReviewInput,
  PlatformAccountingSummary,
  PlatformWalletTransactionView,
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
    const monthStart = new Date(
      Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1),
    );
    const [earnings, commissionTransactions, totalCommission] =
      await Promise.all([
        this.prisma.walletTransaction.findMany({
          where: {
            walletId: wallet.id,
            type: {
              in: [
                WalletTransactionType.EARNING,
                WalletTransactionType.COMMISSION,
              ],
            },
            createdAt: { gte: monthlyStart },
          },
          select: { type: true, amount: true, createdAt: true },
        }),
        this.prisma.walletTransaction.findMany({
          where: {
            walletId: wallet.id,
            type: WalletTransactionType.COMMISSION,
            createdAt: { gte: monthStart },
          },
          select: { amount: true },
        }),
        this.prisma.walletTransaction.aggregate({
          where: {
            walletId: wallet.id,
            type: WalletTransactionType.COMMISSION,
          },
          _sum: { amount: true },
        }),
      ]);
    const monthlyTotals = new Map<string, number>();
    for (const earning of earnings) {
      if (earning.type !== WalletTransactionType.EARNING) continue;
      const key = `${earning.createdAt.getUTCFullYear()}-${earning.createdAt.getUTCMonth()}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + earning.amount);
    }
    const currentMonthEarned = earnings
      .filter(
        (earning) =>
          earning.type === WalletTransactionType.EARNING &&
          earning.createdAt >= monthStart,
      )
      .reduce((total, earning) => total + earning.amount, 0);
    const currentMonthCommission = commissionTransactions.reduce(
      (total, transaction) => total + Math.abs(transaction.amount),
      0,
    );
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
      totalNetEarned:
        wallet.totalEarned - Math.abs(totalCommission._sum.amount ?? 0),
      totalWithdrawn: wallet.totalWithdrawn,
      totalCommission: Math.abs(totalCommission._sum.amount ?? 0),
      currentMonthEarned,
      currentMonthNetEarned: currentMonthEarned - currentMonthCommission,
      currentMonthCommission,
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

  async listPayoutRequests(
    page: number,
    pageSize: number,
    status?: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED',
  ) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where = status ? { status } : {};
    const [payouts, total] = await this.prisma.$transaction([
      this.prisma.payoutRequest.findMany({
        where,
        include: {
          wallet: {
            include: {
              providerProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);
    return {
      items: payouts.map((payout) => this.toPayoutView(payout)),
      page: safePage,
      pageSize: safePageSize,
      total,
    };
  }

  async listMyPayoutRequests(userId: string): Promise<PayoutRequestView[]> {
    const payouts = await this.prisma.payoutRequest.findMany({
      where: { wallet: { providerProfile: { userId } } },
      include: {
        wallet: {
          include: {
            providerProfile: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return payouts.map((payout) => this.toPayoutView(payout));
  }

  async reviewPayoutRequest(
    input: PayoutReviewInput,
  ): Promise<PayoutRequestView> {
    return this.prisma.$transaction(async (db) => {
      const payout = await db.payoutRequest.findUnique({
        where: { id: input.payoutRequestId },
        select: { id: true, walletId: true, amount: true, status: true },
      });
      if (!payout) throw new NotFoundException('درخواست برداشت پیدا نشد');

      const updated = await db.payoutRequest.updateMany({
        where: { id: payout.id, status: 'PENDING' },
        data: {
          status: input.decision,
          referenceCode: input.decision === 'PAID' ? input.referenceCode : null,
          rejectReason:
            input.decision === 'REJECTED' ? input.rejectReason : null,
          processedById: input.adminUserId,
          processedAt: new Date(),
        },
      });
      if (!updated.count) {
        throw new BadRequestException('این درخواست برداشت قبلاً بررسی شده است');
      }

      if (input.decision === 'PAID') {
        await db.wallet.update({
          where: { id: payout.walletId },
          data: { totalWithdrawn: { increment: payout.amount } },
        });
      } else {
        const wallet = await db.wallet.update({
          where: { id: payout.walletId },
          data: { balance: { increment: payout.amount } },
          select: { balance: true },
        });
        await db.walletTransaction.create({
          data: {
            walletId: payout.walletId,
            type: WalletTransactionType.PAYOUT_REFUND,
            amount: payout.amount,
            balanceAfter: wallet.balance,
            description: input.rejectReason ?? 'درخواست برداشت رد شد',
            payoutRequestId: payout.id,
          },
        });
      }

      const reviewed = await db.payoutRequest.findUniqueOrThrow({
        where: { id: payout.id },
        include: {
          wallet: {
            include: {
              providerProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
      });
      return this.toPayoutView(reviewed);
    });
  }

  async getPlatformAccountingSummary(): Promise<PlatformAccountingSummary> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [
      allPayments,
      monthPayments,
      allCommission,
      monthCommission,
      wallets,
      monthProviderEarnings,
      pendingPayouts,
      paidPayouts,
      monthPaidPayouts,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amountToman: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'PAID', paidAt: { gte: monthStart } },
        _sum: { amountToman: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: { type: WalletTransactionType.COMMISSION },
        _sum: { amount: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          type: WalletTransactionType.COMMISSION,
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.wallet.aggregate({
        _sum: { balance: true, totalEarned: true },
      }),
      this.prisma.walletTransaction.aggregate({
        where: {
          type: WalletTransactionType.EARNING,
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { status: 'PAID', processedAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    return {
      allTimePaidVolumeToman: allPayments._sum.amountToman ?? 0,
      currentMonthPaidVolumeToman: monthPayments._sum.amountToman ?? 0,
      allTimePlatformCommissionToman: Math.abs(allCommission._sum.amount ?? 0),
      currentMonthPlatformCommissionToman: Math.abs(
        monthCommission._sum.amount ?? 0,
      ),
      providerGrossEarningsToman: wallets._sum.totalEarned ?? 0,
      currentMonthProviderGrossEarningsToman:
        monthProviderEarnings._sum.amount ?? 0,
      providerAvailableBalanceToman: wallets._sum.balance ?? 0,
      providerFundsHeldToman:
        (wallets._sum.balance ?? 0) + (pendingPayouts._sum.amount ?? 0),
      pendingPayoutAmountToman: pendingPayouts._sum.amount ?? 0,
      pendingPayoutCount: pendingPayouts._count._all,
      totalPaidOutToman: paidPayouts._sum.amount ?? 0,
      currentMonthPaidOutToman: monthPaidPayouts._sum.amount ?? 0,
    };
  }

  async listPlatformTransactions(
    page: number,
    pageSize: number,
    filter: {
      type?: WalletTransactionType;
      direction?: 'in' | 'out';
      createdFrom?: Date;
      createdTo?: Date;
    },
  ): Promise<PaginatedResult<PlatformWalletTransactionView>> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const where: Prisma.WalletTransactionWhereInput = {};
    if (filter.type) where.type = filter.type;
    if (filter.direction === 'in') where.amount = { gt: 0 };
    if (filter.direction === 'out') where.amount = { lt: 0 };
    if (filter.createdFrom || filter.createdTo) {
      where.createdAt = {
        ...(filter.createdFrom && { gte: filter.createdFrom }),
        ...(filter.createdTo && { lte: filter.createdTo }),
      };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.walletTransaction.findMany({
        where,
        include: {
          wallet: {
            include: {
              providerProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
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
      rows.map((row) => ({
        ...this.toTransactionView({
          ...row,
          payoutStatus: row.payoutRequestId
            ? (payoutStatuses.get(row.payoutRequestId) ?? null)
            : null,
        }),
        providerProfileId: row.wallet.providerProfileId,
        providerName: row.wallet.providerProfile.user.name,
      })),
      total,
    );
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

  private toPayoutView(payout: {
    id: string;
    amount: number;
    status: string;
    holderName: string;
    sheba: string;
    bankName: string | null;
    referenceCode: string | null;
    rejectReason: string | null;
    createdAt: Date;
    processedAt: Date | null;
    wallet: {
      providerProfileId: string;
      providerProfile: { user: { name: string } };
    };
  }): PayoutRequestView {
    return {
      id: payout.id,
      providerProfileId: payout.wallet.providerProfileId,
      providerName: payout.wallet.providerProfile.user.name,
      amount: payout.amount,
      status: payout.status as PayoutRequestView['status'],
      holderName: payout.holderName,
      sheba: payout.sheba,
      bankName: payout.bankName,
      referenceCode: payout.referenceCode,
      rejectReason: payout.rejectReason,
      createdAt: payout.createdAt,
      processedAt: payout.processedAt,
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
