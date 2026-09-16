import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '../../lib/pg-db';
import { sessionStore } from '../../lib/session-store';
import { usersTable } from '../../db/schema';
import { protectedRoutes } from '../..';
import { randomUUIDv7 } from 'bun';

beforeEach(async () => {
  await sessionStore.clear();
  await db.delete(usersTable);
});

const url = 'http://localhost:3000/protected';

const protectedRoute = protectedRoutes.get('/protected', ({ userId }) => {
  return userId;
});

describe('middleware/auth-middleware', () => {
  it('should return 200 when multiple cookies are present and session is valid', async () => {
    const { token } = await createUserWithSession();
    const res = await protectedRoute.handle(
      new Request(url, {
        headers: { cookie: `foo=bar; session=${token}; other=1` },
      })
    );
    expect(res.status).toBe(200);
  });

  it('success correct userId', async () => {
    const { userId, token } = await createUserWithSession();

    const res = await protectedRoute.handle(
      new Request(url, {
        headers: { cookie: `session=${token}` },
      })
    );

    expect(res.status).toBe(200);
    const resText = await res.text();
    expect(resText).toEqual(userId);
  });

  it('401 when session expired', async () => {
    const { token } = await createUserWithSession(-60);

    const res = await protectedRoute.handle(
      new Request(url, {
        headers: { cookie: `session=${token}` },
      })
    );

    expect(res.status).toBe(401);
    const resText = await res.text();
    expect(resText).toBe('Unauthorized: Invalid or expired session');
  });

  it('401 when session not found in db', async () => {
    const fakeToken = 'a'.repeat(32);
    const res = await protectedRoute.handle(
      new Request(url, {
        headers: { cookie: `session=${fakeToken}` },
      })
    );
    expect(res.status).toBe(401);
    const resText = await res.text();
    expect(resText).toBe('Unauthorized: Invalid or expired session');
  });

  it('422 cookie session missing,short,too long,symbol', async () => {
    const cases = [
      '',
      'session=',
      'session=short',
      'session=!@#$%^&*()',
      'session=toolongtoolongtoolongtoolongtoolong',
    ];
    for (const session of cases) {
      const res = await protectedRoute.handle(
        new Request(url, {
          method: 'GET',
          headers: { cookie: session },
        })
      );
      expect(res.status).toBe(422);
      const resText = await res.text();
      expect(resText).toContain('Unauthorized: Invalid or expired session');
    }
  });

  it('should return 422 when cookie header is missing entirely', async () => {
    const res = await protectedRoute.handle(new Request(url));
    expect(res.status).toBe(422);
    const resText = await res.text();
    expect(resText).toContain('Unauthorized: Invalid or expired session');
  });

  it('should return 401 when expiresAt equals now (boundary)', async () => {
    const { token } = await createUserWithSession(0);
    // pastikan waktu bergerak melewati expiry
    await new Promise((r) => setTimeout(r, 5));
    const res = await protectedRoute.handle(
      new Request(url, {
        headers: { cookie: `session=${token}` },
      })
    );
    expect(res.status).toBe(401);
    const resText = await res.text();
    expect(resText).toBe('Unauthorized: Invalid or expired session');
  });
});

async function createUserWithSession(ttlSeconds?: number) {
  const userId = randomUUIDv7();
  await db.insert(usersTable).values({
    id: userId,
    email: `test-${userId}@gmail.com`,
  });

  const { token } = await sessionStore.create(userId, ttlSeconds);

  return { userId, token };
}
