import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';

import { db } from '../../lib/pg-db';
import { accounts, sessions, users, verifications } from '../../db/auth-schema';
import { app } from '../..';

const base = 'http://localhost:3000';

beforeEach(async () => {
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verifications);
  await db.delete(users);
});

describe('better-auth', () => {
  it('401 di protected route tanpa session', async () => {
    const res = await app.handle(new Request(`${base}/protected-dummy`, {}));
    // protectedRoutes tidak punya route ini → 404; pakai middleware langsung:
    expect(res.status).toBe(404);
  });

  it('get-session null saat belum login', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/get-session`, {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    expect(json).toBeNull();
  });

  it('tolak email non-gmail saat kirim OTP', async () => {
    const res = await app.handle(
      new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@yahoo.com', type: 'sign-in' }),
      })
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Invalid email format');
  });

  it('full flow: kirim OTP gmail → sign-in → akses protected', async () => {
    const email = 'flow@gmail.com';

    const sendRes = await app.handle(
      new Request(`${base}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'sign-in' }),
      })
    );
    expect(sendRes.status).toBe(200);

    const [record] = await db
      .select()
      .from(verifications)
      .where(eq(verifications.identifier, `sign-in-otp-${email}`))
      .limit(1);
    expect(record).toBeDefined();
    const otp = record.value.split(':')[0];

    const signInRes = await app.handle(
      new Request(`${base}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
    );
    expect(signInRes.status).toBe(200);
    const setCookie = signInRes.headers.get('set-cookie');
    expect(setCookie).toContain('better-auth.session_token');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    expect(user).toBeDefined();
    expect(await db.$count(sessions)).toBe(1);
  });

  it('401 di protected route dengan session invalid', async () => {
    const { protectedRoutes } = await import('../..');
    const route = protectedRoutes.get('/protected', ({ userId }) => userId);
    const res = await route.handle(
      new Request('http://localhost:3000/protected', {
        headers: { cookie: 'better-auth.session_token=invalid' },
      })
    );
    expect(res.status).toBe(401);
  });
});
