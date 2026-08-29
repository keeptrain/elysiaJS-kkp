// test/index.test.ts
import { readdir } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'bun:test';
import { loginApp, loginRoute } from '../index';
import { db } from '../../../../lib/turso-db';
import { otpsTable, sessionsTable, usersTable } from '../../../../db/schema';
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  await db.delete(otpsTable);
  await db.delete(sessionsTable);
  await db.delete(usersTable);
});

async function getLastOtpMail(email: string) {
  const otpDir = 'src/modules/auth/login/_test/otp-mail';
  const files = (await readdir(otpDir)).filter((f) => f.includes(email));
  if (files.length === 0) return null;
  const lastFile = files.sort().at(-1)!;
  const html = await Bun.file(`${otpDir}/${lastFile}`).text();
  const match = html.match(/<strong>(\d{6})<\/strong>/);
  return { html, code: match?.[1] ?? null, file: lastFile };
}

const url = `http://localhost:3000${loginRoute}`;

describe('auth/login/index Controller', () => {
  describe('success', () => {
    it('user login without create user when already created with valid email and otp ', async () => {
      // create user first via OTP flow
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'existing@gmail.com' }),
        })
      );
      const firstOtp = (await getLastOtpMail('existing@gmail.com'))!.code!;
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'existing@gmail.com', otp: firstOtp }),
        })
      );
      expect(await db.$count(usersTable)).toBe(1);
      expect(await db.$count(sessionsTable)).toBe(1);
      await db.delete(sessionsTable); // clear sessions to test second session creation

      // send OTP again for existing user
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'existing@gmail.com' }),
        })
      );
      const secondOtp = (await getLastOtpMail('existing@gmail.com'))!.code!;
      const verifyRes = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'existing@gmail.com', otp: secondOtp }),
        })
      );
      expect(verifyRes.status).toBe(200);
      expect(await db.$count(usersTable)).toBe(1); // still 1 user
      expect(await db.$count(sessionsTable)).toBe(1); // new session created
    });

    it('user login with correct otp and create user if not exists', async () => {
      expect(await db.$count(usersTable)).toBe(0);

      // first step: send OTP
      const sendRes = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'newuser@gmail.com' }),
        })
      );
      expect(sendRes.status).toBe(200);
      expect(await db.$count(usersTable)).toBe(0); // user not created yet on OTP send

      const otpMail = await getLastOtpMail('newuser@gmail.com');
      expect(otpMail).not.toBeNull();
      const otpCode = otpMail!.code!;

      // second step: verify OTP and create user
      const verifyRes = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'newuser@gmail.com', otp: otpCode }),
        })
      );
      expect(verifyRes.status).toBe(200);
      expect(await db.$count(usersTable)).toBe(1);
      expect(await db.$count(sessionsTable)).toBe(1);
      const user = await db
        .select()
        .from(usersTable)
        .where(sql`email = ${'newuser@gmail.com'}`);
      expect(user[0].email).toBe('newuser@gmail.com');

      const responseJson = await verifyRes.json();
      expect(responseJson).toEqual({
        message: 'Login successful, OTP verified.',
      });

      const sessionCookie = verifyRes.headers.get('set-cookie');
      expect(sessionCookie).toMatch(/session=/);

      // pastikan session di db sesuai cookie, length 32 dan expires sesuai
      const cookieToken = sessionCookie!.match(/session=([^;]+)/)?.[1];
      expect(cookieToken).toBeDefined();
      expect(cookieToken!.length).toBe(32);

      const dbSession = await db
        .select()
        .from(sessionsTable)
        .where(sql`token = ${cookieToken}`);
      expect(dbSession.length).toBe(1);
      expect(dbSession[0].token).toBe(cookieToken);
      expect(dbSession[0].token.length).toBe(32);
      const expiresAt = new Date(dbSession[0].expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      // expires ~24 jam (86400s) toleransi 5 menit
      const diffMs = expiresAt.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
    });

    it('user login without creating user when first time login and otp sending', async () => {
      expect(await db.$count(usersTable)).toBe(0);
      expect(await db.$count(otpsTable)).toBe(0);

      const res = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nouser@gmail.com' }),
        })
      );
      expect(res.status).toBe(200);

      const responseJson = await res.json();
      expect(responseJson).toEqual({
        data: {
          email: 'nouser@gmail.com',
        },
        message: 'Login berhasil, silakan cek email Anda untuk kode OTP.',
      });

      expect(await db.$count(usersTable)).toBe(0);
      expect(await db.$count(otpsTable)).toBe(1);
      expect(await db.$count(sessionsTable)).toBe(0);

      const otpMail = await getLastOtpMail('nouser@gmail.com');
      expect(otpMail).not.toBeNull();
      expect(otpMail!.html).toContain('This code will expire in 5 minutes');
    });
  });

  describe('validation', () => {
    it('returns a validation error when otp is not 6 digits', async () => {
      for (const otp of ['123', '1234567', 'abc123', '12 345', '']) {
        const res = await loginApp.handle(
          new Request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@gmail.com', otp }),
          })
        );
        expect(res.status).toBe(422);
        const text = await res.text();
        expect(text).toContain('Invalid OTP format');
      }
    });

    it('returns a validation error when body otp invalid type', async () => {
      const invalidTypes = [null, {}, false];
      for (const otp of invalidTypes) {
        const res = await loginApp.handle(
          new Request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@gmail.com', otp }),
          })
        );
        expect(res.status).toBe(422);
        const text = await res.text();
        expect(text).toContain('Invalid OTP format');
      }
    });

    it('returns a validation error when only otp body without email', async () => {
      const responseBoolean = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otp: '123456' }),
        })
      );

      expect(responseBoolean.status).toBe(422);
    });

    it('returns a validation error when minimum lenght', async () => {
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test' }),
        })
      );

      expect(response.status).toBe(422);

      const text = await response.text();
      expect(text).toContain('Invalid email format');
    });

    it('returns a validation error when maximum', async () => {
      const longEmail = 'a'.repeat(51) + '@gmail.com';
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: longEmail }),
        })
      );

      expect(response.status).toBe(422);

      const text = await response.text();
      expect(text).toContain('Invalid email format');
    });

    it('returns a validation error when invalid format', async () => {
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'invalid-email' }),
        })
      );

      expect(response.status).toBe(422);

      const text = await response.text();
      expect(text).toContain('Invalid email format');
    });

    it('returns a validation error when invalid pattern e.g not gmail.com', async () => {
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'email@yahoo.com' }),
        })
      );

      expect(response.status).toBe(422);

      const text = await response.text();
      expect(text).toContain('Invalid email format');
    });
  });
});
