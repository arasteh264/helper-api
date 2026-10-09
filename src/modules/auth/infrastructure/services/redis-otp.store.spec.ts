import { RedisService } from '../../../../infrastructure/cache/redis.service';
import { RedisOtpStore } from './redis-otp.store';

describe('RedisOtpStore', () => {
  let redis: RedisService;
  let store: RedisOtpStore;

  beforeEach(() => {
    redis = new RedisService();
    store = new RedisOtpStore(redis);
  });

  it('stores login OTPs in Redis with a 90-second TTL and a hashed identifier', async () => {
    const setValue = jest.spyOn(redis, 'setEphemeralValue').mockResolvedValue();

    await store.save('login', '09121234567', '123456');

    expect(setValue).toHaveBeenCalledWith(
      expect.stringMatching(/^otp:login:[a-f0-9]{64}$/),
      '123456',
      90,
    );
    expect(setValue.mock.calls[0][0]).not.toContain('09121234567');
  });

  it('uses a separate namespace for registration OTPs', async () => {
    const consumeValue = jest
      .spyOn(redis, 'consumeEphemeralValueIfMatches')
      .mockResolvedValue(true);

    await expect(
      store.consumeIfMatches('registration', '09121234567', '123456'),
    ).resolves.toBe(true);

    expect(consumeValue).toHaveBeenCalledWith(
      expect.stringMatching(/^otp:registration:[a-f0-9]{64}$/),
      '123456',
    );
  });
});
