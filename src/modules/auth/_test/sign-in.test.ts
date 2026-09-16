import { beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia, status } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { sessions, accounts, verifications, users } from '@/db/auth-schema';
import { app } from '@/index';

const base = 'http://localhost:3000';

// Helper resmi better-auth (plugin testUtils, aktif saat NODE_ENV=test).
const ctx = await auth.$context;
const test = (ctx as typeof ctx & { test: TestHelpers }).test;

beforeEach(async () => {
  test.clearOTPs!();
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verifications);
  await db.delete(users);
});

// ---------------------------------------------------------------------------
// Mock callback endpoint: simulasi pertukaran `code` OAuth tanpa memanggil
// Google. `valid-mock-code` → session cookie, selain itu 400.
// ---------------------------------------------------------------------------
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

describe('sign-in email-otp', () => {
  it('tolak email non-gmail saat kirim OTP', async () => {
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

  it('kirim OTP ke gmail bisa diambil via getOTP', async () => {
    const email = 'signin@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });

    const otp = test.getOTP!(email);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('tolak OTP salah', async () => {
    const email = 'wrong@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '000000' }),
      })
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid OTP');
  });

  it('tolak sign-in tanpa otp', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'noop@gmail.com' }),
      })
    );
    expect([400, 422]).toContain(res.status);
  });

  it('sign-in dengan OTP benar membuat user + session + cookie', async () => {
    const email = 'ok@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });
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
    expect(res.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    expect(user).toBeDefined();
    expect(await db.$count(sessions)).toBe(1);
  });
});

describe('sign-in social + callback', () => {
  it('POST /sign-in/social mengembalikan URL OAuth Google', async () => {
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

  it('GET /callback/google dengan state invalid redirect ke error', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/callback/google?code=x&state=y`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });
});

describe('mock callback endpoint', () => {
  it('code valid → 200 + set-cookie session mock', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=valid-mock-code`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('mock.session_token');
    const json = (await res.json()) as { user: { email: string } };
    expect(json.user.email).toBe('mock@gmail.com');
  });

  it('code invalid → 400', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=salah`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid code');
  });

  it('tanpa code → 400', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing code');
  });
});
