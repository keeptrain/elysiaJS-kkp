import { Elysia, status } from 'elysia';
import { InMemoryRateLimiter } from '../utils/in-memory-rate-limiter';

const limiter = new InMemoryRateLimiter(60000, 1); // 1 request per minute

export const publicMiddleware = new Elysia({ name: 'public-middleware' })
  .onBeforeHandle({ as: 'global' }, ({ request, server, headers }) => {
    // server.requestIP paling akurat di Bun, fallback ke x-forwarded-for (ambil IP pertama)
    const forwarded = headers['x-forwarded-for'] || request.headers.get('x-forwarded-for');
    const ip =
      (server as any)?.requestIP?.(request)?.address ||
      forwarded?.split(',')[0]?.trim() ||
      '127.0.0.1';

    const { allowed, retryAfter } = limiter.check(ip);

    if (!allowed) {
      return status(429, {
        message: `Too Many Requests: Silakan coba lagi dalam ${retryAfter} detik.`,
      });
    }
  })
  .decorate('getDate', () => Date.now())
  // expose limiter untuk testing / reset
  .decorate('limiter', limiter);
