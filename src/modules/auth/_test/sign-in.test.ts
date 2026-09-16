import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia, status } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { sessions, users } from '@/db/auth-schema';
import { app } from '@/index';
import { cleanAuthDb } from './utils';

const base = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Mock OAuth callback – simulates exchanging an OAuth `code` without
// calling Google. `valid-mock-code` → mock session cookie, otherwise 400.
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

  it('should reject non-Gmail addresses when requesting an OTP', async () => {
    // Non-Gmail addresses are blocked at the edge (betterAuthView); the
    // API must respond with 400 and mention the email format.
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

  it('should generate a 6-digit OTP for a valid Gmail address', async () => {
    // Given a Gmail address requesting sign-in
    const email = 'signin@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });

    // Then the OTP should be capturable via the test helper
    const otp = test.getOTP!(email);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('should reject sign-in with an incorrect OTP', async () => {
    // Given a valid OTP was issued
    const email = 'wrong@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });

    // When signing in with a wrong code
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '000000' }),
      })
    );

    // Then the request should be rejected
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid OTP');
  });

  it('should reject sign-in when OTP is missing', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'noop@gmail.com' }),
      })
    );
    expect([400, 422]).toContain(res.status);
  });

  it('should create a user, session, and set a session cookie with a valid OTP', async () => {
    // Given a Gmail address that received a valid OTP
    const email = 'ok@gmail.com';
    await auth.api.sendVerificationOTP({
      body: { email, type: 'sign-in' },
    });
    const otp = test.getOTP!(email);
    expect(otp).toBeDefined();

    // When signing in with the correct OTP
    const res = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
    );

    // Then a user + session should be created and a session cookie set
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

  it('should return user data for an authenticated request (protected-route pattern)', async () => {
    // Setup — same pattern as `describe("protected route")` reference
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
});

describe('sign-in via OAuth (Google)', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
  });

  it('should return a Google OAuth URL when starting a social sign-in', async () => {
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

  it('should redirect to an error when the OAuth callback state is invalid', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/callback/google?code=x&state=y`)
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=state_mismatch');
  });

  it('should return user data for authenticated request (same helper as protected route)', async () => {
    // Setup
    const user = test.createUser({ email: 'oauth-test@gmail.com' });
    await test.saveUser(user);
    // Get authenticated headers
    const headers = await test.getAuthHeaders({ userId: user.id });
    // Test authenticated request
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);
    // Cleanup
    await test.deleteUser(user.id);
  });
});

describe('mock OAuth callback (isolated, no Google network call)', () => {
  it('should return 200 and set a mock session cookie for a valid code', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=valid-mock-code`)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('mock.session_token');
    const json = (await res.json()) as { user: { email: string } };
    expect(json.user.email).toBe('mock@gmail.com');
  });

  it('should return 400 when the code is invalid', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock?code=salah`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid code');
  });

  it('should return 400 when the code query param is missing', async () => {
    const res = await mockCallbackApp.handle(
      new Request(`${base}/api/auth/callback/mock`)
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Missing code');
  });
});
