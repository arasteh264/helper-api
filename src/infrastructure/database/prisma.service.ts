import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const databaseUrl = new URL(connectionString);
    if (databaseUrl.searchParams.get('sslmode') === 'require') {
      databaseUrl.searchParams.set('uselibpqcompat', 'true');
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl.toString(),
      max: getPositiveInteger(process.env.DATABASE_POOL_MAX, 5),
      idleTimeoutMillis: getPositiveInteger(
        process.env.DATABASE_POOL_IDLE_TIMEOUT_MS,
        30_000,
      ),
      connectionTimeoutMillis: getPositiveInteger(
        process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
        10_000,
      ),
      maxLifetimeSeconds: getPositiveInteger(
        process.env.DATABASE_POOL_MAX_LIFETIME_SECONDS,
        300,
      ),
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });

    super({ adapter });
  }
}
