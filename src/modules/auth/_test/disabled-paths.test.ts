import { describe, expect, it } from 'bun:test';
import { app } from '@/index';
import {
  betterAuthEnabledPaths,
  betterAuthDisabledPaths,
} from '@/constants/routes';

const base = 'http://localhost:3000';

// enabledPaths with correct HTTP methods → not 404
const enabledPaths = [
  { method: 'POST', path: '/email-otp/send-verification-otp' },
  { method: 'POST', path: '/sign-in/email-otp' },
  { method: 'POST', path: '/sign-in/social' },
  { method: 'GET', path: '/get-session' },
  { method: 'POST', path: '/sign-out' },
];

describe('disabled Better Auth paths → 404', () => {
  it.each(betterAuthDisabledPaths.map((p) => ({ path: p })))(
    'POST $path → 404',
    async ({ path }) => {
      const res = await app.handle(
        new Request(`${base}/api/auth${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      );
      expect(res.status).toBe(404);
    }
  );

  it.each(betterAuthDisabledPaths.map((p) => ({ path: p })))(
    'GET $path → 404',
    async ({ path }) => {
      const res = await app.handle(
        new Request(`${base}/api/auth${path}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(res.status).toBe(404);
    }
  );
});

describe('enabled Better Auth paths → not 404', () => {
  it.each(enabledPaths)('$method $path → not 404', async ({ method, path }) => {
    const res = await app.handle(
      new Request(`${base}/api/auth${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      })
    );
    expect(res.status).not.toBe(404);
  });
});
