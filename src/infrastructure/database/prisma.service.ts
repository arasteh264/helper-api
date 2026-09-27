import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';

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
    });

    super({ adapter });
  }
}
