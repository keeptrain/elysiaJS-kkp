import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia, status } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { sessions, users } from '@/db/auth-schema';
import { app } from '@/index';
import { treaty } from '@elysia/eden';
import { cleanAuthDb } from './utils';

const api = treaty(app).api;
const base = 'http://localhost:3000';

function mockExchangeCode(code: string) {
  if (code === 'valid-mock-code') {
    return { id: 'mock-user-id', email: 'mock@gmail.com', name: 'Mock User' };
  }
  throw new Error('invalid_grant');
}

export const mockCallbackApp = new Elysia().get(
  '/api/auth/callback/mock',
  ({ query, set }) => {
    const code = (query as { code?: string }).code;
    if (!code) return status(400, { message: 'Missing code' });
    try {
      const profile = mockExchangeCode(code);
      set.headers['set-cookie'] =
        `mock.session_token=mock-session-for-${profile.id}; Path=/; HttpOnly`;
      return { user: profile };
    } catch {
      return status(400, { message: 'Invalid code' });
    }
  }
);

async function authedHeaders(email: string) {
  const ctx = await auth.$context;
  const test = ctx.test;
  const user = test.createUser({ email });
  await test.saveUser(user);
  const raw = await test.getAuthHeaders({ userId: user.id });
  const userId = user.id;
  return {
    headers: Object.fromEntries(raw.entries()),
    cleanup: async () => { await test.deleteUser(userId); },
  };
}

// ── Happy path: email OTP ─────────────────────────────
describe('sign-in via email OTP', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    test.clearOTPs!();
    await cleanAuthDb();
  });

  it('generates a 6-digit OTP for a valid Gmail address', async () => {
    const email = 'signin@gmail.com';
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    const otp = test.getOTP!(email);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('creates user, session, and sets cookie with valid OTP', async () => {
    const email = 'ok@gmail.com';
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    const otp = test.getOTP!(email);
    expect(otp).toBeDefined();

    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token');

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(user).toBeDefined();
    expect(await db.$count(sessions)).toBe(1);
  });

  it('returns user data for authenticated request', async () => {
    const user = test.createUser({ email: 'test@example.com' });
    await test.saveUser(user);
    const headers = await test.getAuthHeaders({ userId: user.id });
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);
    await test.deleteUser(user.id);
  });
});

// ── Happy path: OAuth Google ──────────────────────────
describe('sign-in via OAuth (Google)', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
  });

  it('returns Google OAuth URL when starting social sign-in', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: 'http://localhost:3000',
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string; redirect: boolean };
    expect(json.url).toContain('accounts.google.com');
    expect(decodeURIComponent(json.url)).toContain('/api/auth/callback/google');
  });

  it('returns user data for authenticated request', async () => {
    const user = test.createUser({ email: 'oauth-test@gmail.com' });
    await test.saveUser(user);
    const headers = await test.getAuthHeaders({ userId: user.id });
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);
    await test.deleteUser(user.id);
  });
});

// ── Edge cases ────────────────────────────────────────
describe('edge cases', () => {
  it('rejects non-Gmail OTP request at edge', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@yahoo.com', type: 'sign-in' }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid email format');
  });

  it('redirects to error when OAuth callback state is invalid', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/callback/google?code=x&state=y`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });
});

// ── Mock OAuth callback ───────────────────────────────
describe('mock OAuth callback (isolated)', () => {
  it('returns 200 and sets mock session cookie for valid code', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=valid-mock-code`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('mock.session_token');
  });

  it('returns 400 when the code is invalid', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=salah`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid code');
  });

  it('returns 400 when the code query param is missing', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing code');
  });
});

// ── Body validation (422) via treaty ──────────────────
describe('body validation (422)', () => {
  it('rejects sign-in with incorrect OTP', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@gmail.com', otp: '000000' }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid OTP');
  });

  it('rejects sign-in when OTP is missing', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'noop@gmail.com' }),
      })
    );
    expect([400, 422]).toContain(res.status);
  });
});
