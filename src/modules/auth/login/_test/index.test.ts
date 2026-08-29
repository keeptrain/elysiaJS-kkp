// test/index.test.ts
import { readdir } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { loginApp, loginRoute } from '../index';
import { db } from '../../../../lib/turso-db';
import { otpsTable, sessionsTable, usersTable } from '../../../../db/schema';
import { sql } from 'drizzle-orm';
import { Glob } from 'bun';
import { expectCookieValid, getCookie } from './utils';

beforeEach(async () => {
  await db.delete(otpsTable);
  await db.delete(sessionsTable);
  await db.delete(usersTable);
});

afterAll(async () => {
  // Clean up OTP mail files after tests
  const glob = new Glob('*.html');

  // Delete all files in the otp-mail directory
  for (const file of glob.scanSync('src/modules/auth/login/_test/otp-mail')) {
    await Bun.file(`src/modules/auth/login/_test/otp-mail/${file}`).delete();
  }
});

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

      // check session cookie and database entry
      const sessionCookie = await getCookie(verifyRes.headers, 'session');
      await expectCookieValid(sessionCookie!);
      await expectSessionInDb(sessionCookie!);
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

      // check session cookie and database entry
      const sessionCookie = await getCookie(verifyRes.headers, 'session');
      await expectCookieValid(sessionCookie!);
      await expectSessionInDb(sessionCookie!);
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

  describe('error', () => {
    it('when otp is invalid', async () => {
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'wrongotp@gmail.com' }),
        })
      );
      const wrongOtp = '000000';
      const res = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'wrongotp@gmail.com', otp: wrongOtp }),
        })
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe('OTP tidak valid atau sudah kadaluarsa.');
    });

    it('when otp is expired', async () => {
      const email = 'expired@gmail.com';
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      );
      const otpMail = await getLastOtpMail(email);
      const code = otpMail!.code!;
      // expire the otp
      await db
        .update(otpsTable)
        .set({ expiresAt: new Date(Date.now() - 60 * 1000).toISOString() })
        .where(sql`email = ${email} AND code = ${code}`);

      const res = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: code }),
        })
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe('OTP tidak valid atau sudah kadaluarsa.');
    });

    it('when otp is used', async () => {
      const email = 'used@gmail.com';
      await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      );
      const otpMail = await getLastOtpMail(email);
      const code = otpMail!.code!;
      // first use - success
      const firstRes = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: code }),
        })
      );
      expect(firstRes.status).toBe(200);
      // mark as used
      await db
        .update(otpsTable)
        .set({ isUsed: 1 })
        .where(sql`email = ${email} AND code = ${code}`);

      // second use - should fail
      const secondRes = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: code }),
        })
      );
      expect(secondRes.status).toBe(401);
      const body = await secondRes.json();
      expect(body.message).toBe('OTP tidak valid atau sudah kadaluarsa.');
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

async function getLastOtpMail(email: string) {
  const otpDir = 'src/modules/auth/login/_test/otp-mail';
  const files = (await readdir(otpDir)).filter((f) => f.includes(email));
  if (files.length === 0) return null;
  const lastFile = files.sort().at(-1)!;
  const html = await Bun.file(`${otpDir}/${lastFile}`).text();
  const match = html.match(/<strong>(\d{6})<\/strong>/);
  return { html, code: match?.[1] ?? null, file: lastFile };
}

/**
 * Expect the session with the given token to exist in the database.
 * @param token
 * @param expiredAt Max age in seconds
 */
async function expectSessionInDb(sessionCookie: {
  value: string;
  maxAge: number;
}) {
  const sessionInDb = await db
    .select()
    .from(sessionsTable)
    .where(sql`token = ${sessionCookie.value}`)
    .limit(1);

  const session = sessionInDb[0];
  expect(sessionInDb.length).toBe(1);
  expect(session.token).toEqual(sessionCookie.value);

  const expiresAt = new Date(session.expiresAt).getTime();
  const now = Date.now();
  const maxAgeInMs = sessionCookie.maxAge * 1000;

  // Check that the expiresAt in the database is within a reasonable range of the maxAge from the cookie
  expect(expiresAt).toBeGreaterThanOrEqual(now);
  expect(expiresAt).toBeLessThanOrEqual(now + maxAgeInMs + 1000); // Allow 1 second margin
  expect(expiresAt).toBeGreaterThan(now);
}
