import { describe, expect, it } from 'bun:test';
import { app } from './index';

const base = 'http://localhost:3000';

describe('openapi docs', () => {
  it('menggabungkan endpoint Better Auth ke /openapi/json', async () => {
    const res = await app.handle(new Request(`${base}/openapi/json`));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      paths: Record<string, Record<string, { tags?: string[] }>>;
    };
    // route Elysia tetap ada, wildcard catch-all disembunyikan
    expect(json.paths['/products']).toBeDefined();
    expect(json.paths['/api/auth/*']).toBeUndefined();
    // endpoint auth muncul satu per satu di bawah tag auth
    const otp = json.paths['/api/auth/sign-in/email-otp']?.post;
    expect(otp).toBeDefined();
    expect(otp?.tags).toContain('auth');
    expect(json.paths['/api/auth/get-session']).toBeDefined();
  });
});
