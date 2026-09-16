import { beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { sessions, accounts, verifications, users } from '@/db/auth-schema';
import { app } from '@/index';
import { authMiddleware } from '@/middleware/auth-middleware';

const base = 'http://localhost:3000';

// Helper resmi better-auth (plugin testUtils, aktif saat NODE_ENV=test).
const ctx = await auth.$context;
const test = (ctx as typeof ctx & { test: TestHelpers }).test;

beforeEach(async () => {
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verifications);
  await db.delete(users);
});

/** Buat user + session, kembalikan Headers berisi cookie session. */
async function authedHeaders(email: string): Promise<Headers> {
  const user = test.createUser({ email });
  await test.saveUser(user);
  return test.getAuthHeaders({ userId: user.id });
}

function withJson(headers: Headers): Headers {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json');
  return h;
}

describe('session', () => {
  it('get-session null saat belum login', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('get-session null dengan token invalid', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, {
        headers: {
          'Content-Type': 'application/json',
          cookie: 'better-auth.session_token=invalid',
        },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('get-session mengembalikan user yang login', async () => {
    const email = 'session@gmail.com';
    const headers = await authedHeaders(email);

    // via API server-side (contoh resmi docs)
    const viaApi = await auth.api.getSession({ headers });
    expect(viaApi?.user.email).toBe(email);

    // via HTTP route
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, { headers })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      user: { email: string };
      session: { token: string };
    };
    expect(json.user.email).toBe(email);
    expect(json.session.token).toBeDefined();
  });

  it('sign-out menghapus session', async () => {
    const headers = await authedHeaders('signout@gmail.com');
    expect(await db.$count(sessions)).toBe(1);

    const outRes = await app.handle(
      new Request(`${base}/api/auth/sign-out`, {
        method: 'POST',
        headers: withJson(headers),
      })
    );
    expect(outRes.status).toBe(200);
    expect(await db.$count(sessions)).toBe(0);

    // cookieCache 5 menit: get-session biasa masih baca cache cookie,
    // jadi verifikasi kebenaran DB dengan disableCookieCache=true.
    const after = await app.handle(
      new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
        headers: withJson(headers),
      })
    );
    expect(await after.json()).toBeNull();
  });

  it('session kedaluwarsa dianggap tidak ada', async () => {
    const user = test.createUser({ email: 'expired@gmail.com' });
    await test.saveUser(user);
    const { headers, session } = await test.login({ userId: user.id });
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.id));

    const res = await app.handle(
      // disableCookieCache: paksa baca DB (cookieCache 5 menit
      // mengembalikan cache cookie walau expiresAt sudah lewat).
      new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
        headers,
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('protected route: 401 tanpa session, 200 dengan session valid', async () => {
    const route = new Elysia()
      .use(authMiddleware)
      .get('/protected', ({ userId }) => userId);

    const anon = await route.handle(new Request(`${base}/protected`));
    expect(anon.status).toBe(401);

    const user = test.createUser({ email: 'guard@gmail.com' });
    await test.saveUser(user);
    const headers = await test.getAuthHeaders({ userId: user.id });
    const authed = await route.handle(
      new Request(`${base}/protected`, { headers })
    );
    expect(authed.status).toBe(200);
    expect(await authed.text()).toBe(user.id);
  });
});
