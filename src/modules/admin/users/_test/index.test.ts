import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { treaty } from '@elysia/eden';
import type { TestHelpers } from 'better-auth/plugins';
import { app } from '@/index';
import { auth } from '@/lib/auth';
import { cleanAuthDb, createAdminUser } from '@/modules/auth/_test/utils';

const api = treaty(app).api;

describe('admin users', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
  });

  async function authed(email: string) {
    const user = await createAdminUser(test, email);
    const raw = await test.getAuthHeaders({ userId: user.id });
    return {
      user,
      headers: raw,
      cleanup: () => test.deleteUser(user.id),
    };
  }

  // ── Auth ──────────────────────────────────────────────
  it('rejects unauthenticated list request (401)', async () => {
    const { status } = await api.users.get({ query: {} });
    expect(status).toBe(401);
  });

  it('rejects non-admin kind list request (403)', async () => {
    const user = test.createUser({ email: 'nonadmin@test.com' });
    await test.saveUser(user);
    const raw = await test.getAuthHeaders({ userId: user.id });
    const { status } = await api.users.get({ query: {}, headers: raw });
    expect(status).toBe(403);
    await test.deleteUser(user.id);
  });

  // ── List (GET /users) ─────────────────────────────────
  describe('list - GET /users', () => {
    it('returns empty list when no users exist', async () => {
      const { headers, cleanup } = await authed('l1@test.com');
      const { data, status } = await api.users.get({ query: {}, headers });
      expect(status).toBe(200);
      expect((data as { items: unknown[] }).items).toHaveLength(1);
      await cleanup();
    });

    it('returns list with search filter', async () => {
      const { headers, cleanup } = await authed('l2@test.com');
      const user = test.createUser({
        email: 'searchtest@test.com',
        name: 'SearchTest',
      });
      await test.saveUser(user);

      const all = await api.users.get({ query: {}, headers });
      expect(all.status).toBe(200);
      expect((all.data as { items: unknown[] }).items).toHaveLength(2);

      const searched = await api.users.get({
        query: { search: 'SearchTest' },
        headers,
      });
      expect(searched.status).toBe(200);
      expect((searched.data as { items: unknown[] }).items).toHaveLength(1);

      const noMatch = await api.users.get({
        query: { search: 'nonexistent' },
        headers,
      });
      expect(noMatch.status).toBe(200);
      expect((noMatch.data as { items: unknown[] }).items).toHaveLength(0);

      await test.deleteUser(user.id);
      await cleanup();
    });

    it('returns nextCursor when more than limit exist', async () => {
      const { headers, cleanup } = await authed('l3@test.com');
      const limit = 2;
      for (let i = 0; i < limit + 1; i++) {
        const u = test.createUser({ email: `cursor${i}@test.com` });
        await test.saveUser(u);
      }

      const { data, status } = await api.users.get({
        query: { limit },
        headers,
      });
      const resp = data as { items: unknown[]; nextCursor: string | null };
      expect(status).toBe(200);
      expect(resp.items).toHaveLength(limit);
      expect(resp.nextCursor).toBeDefined();

      await cleanup();
    });

    it('cursor pagination returns fewer items on second page', async () => {
      const { headers, cleanup } = await authed('l4@test.com');
      const limit = 2;
      const createdUsers: { id: string }[] = [];
      for (let i = 0; i < limit + 1; i++) {
        const u = test.createUser({ email: `cursorpage${i}@test.com` });
        await test.saveUser(u);
        createdUsers.push(u);
      }

      const first = await api.users.get({ query: { limit }, headers });
      expect(first.status).toBe(200);
      const firstData = first.data as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      expect(firstData.items).toHaveLength(limit);
      const cursor = firstData.nextCursor;
      expect(cursor).toBeDefined();

      const second = await api.users.get({
        query: { limit, cursor: cursor! },
        headers,
      });
      expect(second.status).toBe(200);
      const secondData = second.data as { items: { id: string }[] };
      expect(secondData.items.length).toBeLessThanOrEqual(limit);
      expect(secondData.items.length).toBeGreaterThanOrEqual(0);

      await test.deleteUser(createdUsers[0].id);
      await test.deleteUser(createdUsers[1].id);
      await test.deleteUser(createdUsers[2].id);
      await cleanup();
    });
  });

  // ── Actions (POST /users/actions) ─────────────────────
  describe('actions - POST /users/actions', () => {
    it('getById returns user', async () => {
      const { headers, cleanup } = await authed('g1@test.com');
      const user = test.createUser({ email: 'getbyid@test.com' });
      await test.saveUser(user);

      const res = await api.users.actions.post(
        { action: 'getById', id: user.id },
        { headers }
      );
      expect(res.status).toBe(200);
      expect((res.data as { id: string }).id).toBe(user.id);

      await test.deleteUser(user.id);
      await cleanup();
    });

    it('getById unknown id returns 404', async () => {
      const { headers, cleanup } = await authed('g2@test.com');
      const res = await api.users.actions.post(
        { action: 'getById', id: '00000000-0000-0000-0000-000000000000' },
        { headers }
      );
      expect(res.status).toBe(404);
      await cleanup();
    });

    it('getById without id returns 422', async () => {
      const { headers, cleanup } = await authed('g3@test.com');
      const res = await api.users.actions.post(
        // @ts-ignore
        { action: 'getById' },
        { headers }
      );
      expect(res.status).toBe(422);
      await cleanup();
    });

    it('delete removes user', async () => {
      const { headers, cleanup } = await authed('d1@test.com');
      const user = test.createUser({ email: 'deletetest@test.com' });
      await test.saveUser(user);

      const res = await api.users.actions.post(
        { action: 'delete', id: user.id },
        { headers }
      );
      expect(res.status).toBe(200);

      const after = await api.users.actions.post(
        { action: 'getById', id: user.id },
        { headers }
      );
      expect(after.status).toBe(404);

      await test.deleteUser(user.id);
      await cleanup();
    });

    it('delete unknown id returns 200', async () => {
      const { headers, cleanup } = await authed('d2@test.com');
      const res = await api.users.actions.post(
        { action: 'delete', id: '00000000-0000-0000-0000-000000000000' },
        { headers }
      );
      expect(res.status).toBe(200);
      await cleanup();
    });

    it('delete without id returns 422', async () => {
      const { headers, cleanup } = await authed('d3@test.com');
      const res = await api.users.actions.post(
        // @ts-ignore
        { action: 'delete' },
        { headers }
      );
      expect(res.status).toBe(422);
      await cleanup();
    });
  });

  // ── Body validation (422) ─────────────────────────────
  describe('body validation (422)', () => {
    it('rejects unknown action', async () => {
      const { headers, cleanup } = await authed('v1@test.com');
      const res = await api.users.actions.post(
        // @ts-ignore
        { action: 'invalidAction' },
        { headers }
      );
      expect(res.status).toBe(422);
      await cleanup();
    });

    it('rejects empty body', async () => {
      const { headers, cleanup } = await authed('v2@test.com');
      const res = await api.users.actions.post(
        // @ts-ignore
        {},
        {
          headers,
        }
      );
      expect(res.status).toBe(422);
      await cleanup();
    });
  });
});
