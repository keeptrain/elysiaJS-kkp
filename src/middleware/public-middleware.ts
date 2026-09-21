import { redis } from 'bun';
import { Elysia } from 'elysia';
import { env } from '@/constants/env';

export const ipRateLimiterMiddleware = new Elysia({
  name: 'public.middleware',
}).onBeforeHandle(
  { as: 'global' },
  async ({ request, server, headers, set }) => {
    if (env.isTest) return;
    const forwarded =
      headers['x-forwarded-for'] || request.headers.get('x-forwarded-for');
    const ip =
      (server as any)?.requestIP?.(request)?.address ||
      forwarded?.split(',')[0]?.trim() ||
      '127.0.0.1';

    const key = `rate-limit:${ip}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // Reset dalam 60 detik
    }

    if (count > 100) {
      set.status = 429;
      throw new Error('Too many requests');
    }
  }
);
