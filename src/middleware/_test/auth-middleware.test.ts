import { beforeEach, describe, expect, it } from 'bun:test';
import { todo } from 'node:test';
import { db } from '../../lib/turso-db';
import { sessionsTable, usersTable } from '../../db/schema';
import { generateRandomString } from '../../utils/utils';
import { protectedRoutes } from '../..';
import { randomUUIDv7 } from 'bun';
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  await db.delete(sessionsTable);
  await db.delete(usersTable);
});

const url = 'http://localhost:3000/protected';

const protectedRoute = protectedRoutes.get('/protected', ({ userId }) => {
  return userId;
});

describe('middleware/auth-middleware', () => {
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
    const { token } = await createUserWithSession();

    await db
      .update(sessionsTable)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(sql`token = ${token}`);

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
    const fakeToken = generateRandomString(32);
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

  todo('should return 422 when cookie header is missing entirely');
  todo(
    'should return 200 when multiple cookies are present and session is valid'
  );
  todo('should return 401 when expiresAt equals now (boundary)');
  todo(
    'should use unique email per createUserWithSession to avoid UNIQUE constraint'
  );
  todo('should return consistent 401 message for invalid or expired session');
});

async function createUserWithSession() {
  const userId = randomUUIDv7();
  await db.insert(usersTable).values({
    id: userId,
    email: 'test@gmail.com',
  });

  const token = generateRandomString(32);
  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: userId,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .returning({
      userId: sessionsTable.userId,
      token: sessionsTable.token,
      expiresAt: sessionsTable.expiresAt,
    });

  return {
    userId: session.userId,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}
