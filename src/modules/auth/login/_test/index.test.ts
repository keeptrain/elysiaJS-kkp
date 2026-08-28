// test/index.test.ts
import { describe, expect, it } from 'bun:test';
import { loginApp, loginRoute } from '../index';

const url = `http://localhost:3000${loginRoute}`;

describe('auth/login/index Controller', () => {
  describe('success', () => {
    it('returns a response', async () => {
      const response = await loginApp.handle(
        new Request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test1@gmail.com' }),
        })
      );

      // expect(response.status).toBe(200);

      const responseBody = await response.json();
      console.log(responseBody);

      // expect(responseBody).toEqual({
      //   message: 'Login successful for email: test@gmail.com',
      // });
    });
  });

  describe('validation', () => {
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
