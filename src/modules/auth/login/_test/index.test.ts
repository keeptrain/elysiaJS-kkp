// test/index.test.ts
import { readdir } from 'node:fs/promises';
import { beforeEach, describe, expect, it } from 'bun:test';
import { loginApp, loginRoute } from '../index';
import { db } from '../../../../lib/turso-db';
import { otpsTable, sessionsTable, usersTable } from '../../../../db/schema';
import { sql } from 'drizzle-orm';
import { todo } from 'node:test';

beforeEach(async () => {
  await db.delete(otpsTable);
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
    todo('user login with correct otp and create user if not exists');

    todo(
      'user login with correct otp and create session if user already exists'
    );

    todo(
      'user login without creating user when first time login with correct otp sending'
    );

    it('returns a correct response and result', async () => {
      // check the count of otpsTable before the request
      expect(await db.$count(otpsTable)).toBe(0);

      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@gmail.com' }),
        })
      );

      expect(response.status).toBe(200);

      const emails = 'test@gmail.com';

      // check the count of otpsTable after the request
      const currentOtp = await db
        .select()
        .from(otpsTable)
        .where(sql`email = ${emails}`);

      expect(currentOtp.length).toBe(1);

      const otpMail = await getLastOtpMail(emails);
      expect(otpMail).not.toBeNull();
      expect(otpMail!.code).toBe(currentOtp[0].code);
      expect(otpMail!.html).toContain('This code will expire in 5 minutes');

      expect(await db.$count(sessionsTable)).toBe(0);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        data: {
          email: 'test@gmail.com',
        },
        message: 'Login berhasil, silakan cek email Anda untuk kode OTP.',
      });
    });
  });

  describe('validation', () => {
    todo('returns a validation error when otp is not 6 digits');

    it('returns a validation error when body otp invalid type', async () => {
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test', otp: null }),
        })
      );
      expect(response.status).toBe(422);

      const responseEmptyObject = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test', otp: {} }),
        })
      );

      expect(responseEmptyObject.status).toBe(422);

      const responseEmptyString = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test', otp: '' }),
        })
      );

      expect(responseEmptyString.status).toBe(422);

      const responseBoolean = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test', otp: false }),
        })
      );

      expect(responseBoolean.status).toBe(422);
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
