import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly url = process.env.REDIS_URL;
  private readonly keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'helper-api:';
  private client: RedisClientType | undefined;
  private connection: Promise<RedisClientType> | undefined;

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;

      const value = await client.get(this.getKey(key));
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      this.logger.warn(
        `Redis cache read failed for "${key}"; using the primary data source: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      await client.set(this.getKey(key), JSON.stringify(value), {
        EX: ttlSeconds,
      });
    } catch (error) {
      this.logger.warn(
        `Redis cache write failed for "${key}": ${this.errorMessage(error)}`,
      );
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      for await (const keys of client.scanIterator({
        MATCH: `${this.getKey(prefix)}*`,
        COUNT: 100,
      })) {
        if (keys.length > 0) await client.del(keys);
      }
    } catch (error) {
      this.logger.warn(
        `Redis cache invalidation failed for "${prefix}": ${this.errorMessage(error)}`,
      );
    }
  }

  async setEphemeralValue(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.withRequiredClient((client) =>
      client.set(this.getKey(key), value, { EX: ttlSeconds }),
    );
  }

  async getEphemeralValue(key: string): Promise<string | null> {
    return this.withRequiredClient((client) => client.get(this.getKey(key)));
  }

  async consumeEphemeralValueIfMatches(
    key: string,
    expectedValue: string,
  ): Promise<boolean> {
    return this.withRequiredClient(async (client) => {
      const result = await client.eval(
        `if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('DEL', KEYS[1])
        end
        return 0`,
        {
          keys: [this.getKey(key)],
          arguments: [expectedValue],
        },
      );
      return Number(result) === 1;
    });
  }

  async deleteEphemeralValue(key: string): Promise<void> {
    await this.withRequiredClient((client) => client.del(this.getKey(key)));
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  private async getClient(): Promise<RedisClientType | null> {
    if (!this.url) return null;
    if (this.client?.isReady) return this.client;
    if (this.client?.isOpen) return this.client;

    if (!this.connection) {
      const client = createClient({
        url: this.url,
        disableOfflineQueue: true,
        socket: {
          connectTimeout: 3000,
          reconnectStrategy: (retries) =>
            retries > 5
              ? new Error('Redis reconnect limit reached')
              : 250 * retries,
        },
      });
      client.on('error', (error) => {
        this.logger.warn(`Redis connection error: ${this.errorMessage(error)}`);
      });
      this.client = client;
      this.connection = client
        .connect()
        .then(() => client)
        .catch((error: unknown) => {
          client.destroy();
          if (this.client === client) this.client = undefined;
          throw error;
        })
        .finally(() => {
          this.connection = undefined;
        });
    }

    return this.connection;
  }

  private async getRequiredClient(): Promise<RedisClientType> {
    if (!this.url) {
      throw new ServiceUnavailableException(
        'Redis is required for OTP verification but REDIS_URL is not configured',
      );
    }

    try {
      const client = await this.getClient();
      if (client) return client;
    } catch {
      throw new ServiceUnavailableException(
        'Redis is unavailable; OTP operations cannot be completed',
      );
    }

    throw new ServiceUnavailableException(
      'Redis is unavailable; OTP operations cannot be completed',
    );
  }

  private async withRequiredClient<T>(
    operation: (client: RedisClientType) => Promise<T>,
  ): Promise<T> {
    const client = await this.getRequiredClient();
    try {
      return await operation(client);
    } catch (error) {
      this.logger.error(`Redis operation failed: ${this.errorMessage(error)}`);
      throw new ServiceUnavailableException(
        'Redis is unavailable; OTP operations cannot be completed',
      );
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
