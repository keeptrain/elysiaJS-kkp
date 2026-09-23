import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { sessions, users } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { app } from '@/index';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { authMiddleware } from '@/middleware/auth-middleware';
import { authedHeaders, cleanAuthDb, withJson } from './utils';

const base = 'http://localhost:3000';

// NOTE: treaty tidak support Better Auth catch-all routes (return 404),
// jadi HTTP call di file ini pakai app.handle (lihat AGENTS.MD).
// Session 100% di Postgres (secondaryStorage tidak dipasang) + cookieCache 5 menit.

describe('session lifecycle', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
    await db.delete(userOrganizations);
    await db.delete(organizations);
  });

  // ── Happy path ────────────────────────────────────────────
  describe('happy path', () => {
    it('returns the authenticated user via server API and HTTP endpoint', async () => {
      const email = 'session@gmail.com';
      const headers = await authedHeaders(test, email);

      const viaApi = await auth.api.getSession({ headers });
      expect(viaApi?.user.email).toBe(email);

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

    it('returns organization in get-session response (not in cookie)', async () => {
      const email = `org-${Date.now()}@gmail.com`;
      const user = test.createUser({ email });
      await test.saveUser(user);
      const [org] = await db
        .insert(organizations)
        .values({
          id: randomUUIDv7(),
          name: 'UPT Test',
          code: `UPT-${Date.now()}`,
        })
        .returning();
      await db.insert(userOrganizations).values({
        id: randomUUIDv7(),
        userId: user.id,
        organizationId: org.id,
        position: 'head',
        roles: ['shop_admin'],
      });

      const { headers } = await test.login({ userId: user.id });
      const sess = (await auth.api.getSession({ headers })) as unknown as {
        session: { organizationId?: string };
        organization: {
          id: string;
          position: string;
          roles: string[];
        } | null;
      };
      // Tidak masuk session/cookie — hanya di response
      expect(sess.session.organizationId).toBeUndefined();
      expect(sess.organization).toEqual({
        id: org.id,
        position: 'head',
        roles: ['shop_admin'],
      });

      // Via HTTP juga ada
      const res = await app.handle(
        new Request(`${base}/api/auth/get-session`, { headers })
      );
      const json = (await res.json()) as {
        organization: { id: string };
      };
      expect(json.organization.id).toBe(org.id);
    });

    it('reflects membership changes immediately (no stale snapshot)', async () => {
      const email = `org-fresh-${Date.now()}@gmail.com`;
      const user = test.createUser({ email });
      await test.saveUser(user);
      const [org] = await db
        .insert(organizations)
        .values({
          id: randomUUIDv7(),
          name: 'UPT Fresh',
          code: `UPTF-${Date.now()}`,
        })
        .returning();
      const { headers } = await test.login({ userId: user.id });

      const before = (await auth.api.getSession({ headers })) as unknown as {
        organization: unknown;
      };
      expect(before.organization).toBeNull();

      await db.insert(userOrganizations).values({
        id: randomUUIDv7(),
        userId: user.id,
        organizationId: org.id,
        position: 'staff',
        roles: ['shop_operator'],
      });

      const after = (await auth.api.getSession({ headers })) as unknown as {
        organization: { id: string; position: string; roles: string[] };
      };
      expect(after.organization).toEqual({
        id: org.id,
        position: 'staff',
        roles: ['shop_operator'],
      });
    });

    it('sets token + data cookies on real HTTP OTP sign-in', async () => {
      const email = `real-otp-${Date.now()}@gmail.com`;

      const send = await app.handle(
        new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type: 'sign-in' }),
        })
      );
      expect(send.status).toBe(200);

      const otp = test.getOTP!(email);
      const signIn = await app.handle(
        new Request(`${base}/api/auth/sign-in/email-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        })
      );
      expect(signIn.status).toBe(200);

      const setCookies = signIn.headers.getSetCookie();
      expect(setCookies.some((c) => c.startsWith('app.session_token='))).toBe(
        true
      );
      expect(setCookies.some((c) => c.startsWith('app.session_data='))).toBe(
        true
      );
    });

    it('serves get-session from cookie cache, fresh from DB with disableCookieCache', async () => {
      const email = `cache-${Date.now()}@gmail.com`;
      const send = await app.handle(
        new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type: 'sign-in' }),
        })
      );
      expect(send.status).toBe(200);
      const signIn = await app.handle(
        new Request(`${base}/api/auth/sign-in/email-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: test.getOTP!(email) }),
        })
      );
      expect(signIn.status).toBe(200);
      const cookie = signIn.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');

      await db
        .update(users)
        .set({ name: 'changed' })
        .where(eq(users.email, email));

      const cached = await app.handle(
        new Request(`${base}/api/auth/get-session`, {
          headers: { cookie },
        })
      );
      const cachedJson = (await cached.json()) as { user: { name: string } };
      expect(cachedJson.user.name).not.toBe('changed');

      const fresh = await app.handle(
        new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
          headers: { cookie },
        })
      );
      const freshJson = (await fresh.json()) as { user: { name: string } };
      expect(freshJson.user.name).toBe('changed');
    });

    it('deletes the DB session on sign-out so get-session returns null', async () => {
      const headers = await authedHeaders(test, 'signout@gmail.com');
      expect(await db.$count(sessions)).toBe(1);

      const outRes = await app.handle(
        new Request(`${base}/api/auth/sign-out`, {
          method: 'POST',
          headers: withJson(headers),
        })
      );
      expect(outRes.status).toBe(200);
      expect(await db.$count(sessions)).toBe(0);

      const after = await app.handle(
        new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
          headers: withJson(headers),
        })
      );
      expect(await after.json()).toBeNull();
    });
  });

  // ── Bad path ──────────────────────────────────────────────
  describe('bad path', () => {
    it('returns null when no session cookie is present', async () => {
      const res = await app.handle(
        new Request(`${base}/api/auth/get-session`, {
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it('returns null when the session token is invalid', async () => {
      const res = await app.handle(
        new Request(`${base}/api/auth/get-session`, {
          headers: {
            'Content-Type': 'application/json',
            cookie: 'app.session_token=invalid',
          },
        })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it('falls back to DB when the data cookie is tampered', async () => {
      const email = 'tamper@gmail.com';
      const headers = await authedHeaders(test, email);

      const res = await app.handle(
        new Request(`${base}/api/auth/get-session`, {
          headers: withJson(
            new Headers([
              ...headers.entries(),
              ['cookie', 'app.session_data=tampered'],
            ])
          ),
        })
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { user: { email: string } };
      expect(json.user.email).toBe(email);
    });

    it('deletes an expired session and treats it as unauthenticated', async () => {
      const user = test.createUser({ email: 'expired@gmail.com' });
      await test.saveUser(user);
      const { headers, session } = await test.login({ userId: user.id });
      await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.id, session.id));

      const res = await app.handle(
        new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
          headers,
        })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
      expect(await db.$count(sessions)).toBe(0);
    });

    it('returns null for a revoked token after sign-out', async () => {
      const headers = await authedHeaders(test, 'revoked@gmail.com');
      await app.handle(
        new Request(`${base}/api/auth/sign-out`, {
          method: 'POST',
          headers: withJson(headers),
        })
      );

      const res = await app.handle(
        new Request(`${base}/api/auth/get-session?disableCookieCache=true`, {
          headers: withJson(headers),
        })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
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

  it('responds 200 with a valid session', async () => {
    const route = new Elysia()
      .use(authMiddleware)
      .get('/protected', () => 'ok');

    const headers = await authedHeaders(test, 'guard@gmail.com');
    const authed = await route.handle(
      new Request(`${base}/protected`, { headers })
    );
    expect(authed.status).toBe(200);
  });

  it('responds 401 without a session', async () => {
    const route = new Elysia()
      .use(authMiddleware)
      .get('/protected', () => 'ok');

    const anon = await route.handle(new Request(`${base}/protected`));
    expect(anon.status).toBe(401);
  });
});
