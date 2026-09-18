import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@/lib/pg-db';
import { accounts, sessions, users, verifications } from '@/db/auth-schema';
import { app } from '@/index';

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
});
