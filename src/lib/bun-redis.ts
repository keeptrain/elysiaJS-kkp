import type { SecondaryStorage } from 'better-auth';
import { RedisClient } from 'bun';
import { env } from '@/constants/env';

const redis = new RedisClient(env.REDIS_URL);
await redis.connect();

export { redis };

export const redisSecondaryStorage: SecondaryStorage = {
  get(key) {
    return redis.get(key);
  },

  getAndDelete(key) {
    return redis.getdel(key);
  },

  async increment(key, ttl) {
    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new TypeError('Redis increment TTL must be a positive integer');
    }

    const luaScript = `
          local current = redis.call('INCR', KEYS[1])
          if current == 1 then
            redis.call('EXPIRE', KEYS[1], ARGV[1])
          end
          return current
        `;

    const result = await redis.eval(luaScript, 1, key, ttl.toString());
    return typeof result === 'number' ? result : Number(result) || 0;
  },

  async set(key, value, ttl) {
    if (ttl) await redis.set(key, value, 'EX', ttl);
    else await redis.set(key, value);
  },

  async delete(key) {
    await redis.del(key);
  },
};
