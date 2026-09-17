import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { sessions } from '@/db/auth-schema';
import { app } from '@/index';
import { authMiddleware } from '@/middleware/auth-middleware';
import { cleanAuthDb, withJson } from './utils';

const base = 'http://localhost:3000';

describe('session lifecycle', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
  });

  /** Create a persisted user + session and return headers that carry the session cookie. */
  async function authedHeaders(email: string): Promise<Headers> {
    const user = test.createUser({ email });
    await test.saveUser(user);
    return test.getAuthHeaders({ userId: user.id });
  }

  it('should return null when no session cookie is present', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('should return null when the session token is invalid', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, {
        headers: {
          'Content-Type': 'application/json',
          cookie: 'session=invalid',
        },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('should return the authenticated user via both server API and HTTP endpoint', async () => {
    // Given an authenticated user
    const email = 'session@gmail.com';
    const headers = await authedHeaders(email);

    // When the session is read via the server-side API (official docs pattern)
    const viaApi = await auth.api.getSession({ headers });
    expect(viaApi?.user.email).toBe(email);

    // And via the HTTP route
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

  it('should delete the DB session on sign-out so subsequent get-session returns null', async () => {
    // Given a signed-in user
    const headers = await authedHeaders('signout@gmail.com');
    expect(await db.$count(sessions)).toBe(1);

    // When signing out
    const outRes = await app.handle(
      new Request(`${base}/api/auth/sign-out`, {
        method: 'POST',
        headers: withJson(headers),
      })
    );
    expect(outRes.status).toBe(200);
    expect(await db.$count(sessions)).toBe(0);

    // Then get-session must be null — bypass 5-minute cookieCache to hit DB directly
    const after = await app.handle(
      new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
        headers: withJson(headers),
      })
    );
    expect(await after.json()).toBeNull();
  });

  it('should treat an expired DB session as unauthenticated', async () => {
    // Given a user whose session was manually expired in DB
    const user = test.createUser({ email: 'expired@gmail.com' });
    await test.saveUser(user);
    const { headers, session } = await test.login({ userId: user.id });
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.id));

    // When reading the session bypassing the 5-minute cookieCache
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
        headers,
      })
    );

    // Then it should be considered unauthenticated
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

describe('protected route', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
  });

  it('should return user data for authenticated request', async () => {
    // Setup
    const user = test.createUser({ email: 'test@example.com' });
    await test.saveUser(user);
    // Get authenticated headers
    const headers = await test.getAuthHeaders({ userId: user.id });
    // Test authenticated request
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);
    // Cleanup
    await test.deleteUser(user.id);
  });

  it('should respond 401 without a session and 200 with a valid session', async () => {
    const route = new Elysia()
      .use(authMiddleware)
      .get('/protected', ({ userId }) => userId);

    // Unauthenticated → 401
    const anon = await route.handle(new Request(`${base}/protected`));
    expect(anon.status).toBe(401);

    // Authenticated → 200 and returns the user id
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
