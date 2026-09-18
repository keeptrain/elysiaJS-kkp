import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { app } from '@/index';
import { treaty } from '@elysia/eden';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { organizations, userOrganizations } from '@/db/schema';
import { cleanAuthDb, createAdminUser } from '@/modules/auth/_test/utils';
import type { OrganizationsAction } from '@/modules/admin/organizations';

const api = treaty(app).api;
type ActionBody = OrganizationsAction;

describe('organizations (action-based, type-safe)', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
    await db.delete(userOrganizations);
    await db.delete(organizations);
  });

  // Modul admin: user test selalu kind admin agar lolos kind macro.
  async function authed(email: string) {
    const user = await createAdminUser(test, email);
    const raw = await test.getAuthHeaders({ userId: user.id });
    return {
      user,
      headers: Object.fromEntries(raw.entries()),
      cleanup: () => test.deleteUser(user.id),
    };
  }

  // ── Auth ──────────────────────────────────────────────────
  it('rejects unauthenticated requests (401)', async () => {
    const { status } = await api.organizations.post({ action: 'list' });
    expect(status).toBe(401);
  });

  it('rejects non-admin kind (403)', async () => {
    const user = test.createUser({ email: 'nonadmin@gmail.com' });
    await test.saveUser(user);
    const raw = await test.getAuthHeaders({ userId: user.id });
    const { status } = await api.organizations.post(
      { action: 'list' },
      { headers: Object.fromEntries(raw.entries()) }
    );
    expect(status).toBe(403);
    await test.deleteUser(user.id);
  });

  // ── Happy path ────────────────────────────────────────────
  describe('organizations happy path', () => {
    it('lists empty when no data exists', async () => {
      const { headers, cleanup } = await authed('h1@gmail.com');
      const { data, status } = await api.organizations.post(
        { action: 'list' },
        { headers }
      );
      expect(status).toBe(200);
      expect(data).toEqual([]);
      await cleanup();
    });

    it('create then get then list (search matches and not)', async () => {
      const { headers, cleanup } = await authed('h2@gmail.com');

      const created = await api.organizations.post(
        { action: 'create', name: 'UPT Test', code: 'UPT-TEST-01' },
        { headers }
      );
      expect(created.status).toBe(200);
      const orgId = (created.data as { id: string }).id;
      expect(orgId).toBeDefined();

      const got = await api.organizations.post(
        { action: 'get', id: orgId },
        { headers }
      );
      expect(got.status).toBe(200);
      expect((got.data as { code: string }).code).toBe('UPT-TEST-01');

      const match = await api.organizations.post(
        { action: 'list', filters: { search: 'UPT Test' } },
        { headers }
      );
      expect(match.status).toBe(200);
      expect(match.data).toHaveLength(1);

      const noMatch = await api.organizations.post(
        { action: 'list', filters: { search: 'Not Found' } },
        { headers }
      );
      expect(noMatch.status).toBe(200);
      expect(noMatch.data).toEqual([]);

      await cleanup();
    });

    it('update then delete', async () => {
      const { headers, cleanup } = await authed('h4@gmail.com');

      const created = await api.organizations.post(
        { action: 'create', name: 'Old Name', code: 'UPT-OLD' },
        { headers }
      );
      const orgId = (created.data as { id: string }).id;

      const updated = await api.organizations.post(
        { action: 'update', id: orgId, name: 'New Name' },
        { headers }
      );
      expect(updated.status).toBe(200);
      expect((updated.data as { name: string }).name).toBe('New Name');
      expect((updated.data as { code: string }).code).toBe('UPT-OLD');

      const deleted = await api.organizations.post(
        { action: 'delete', id: orgId },
        { headers }
      );
      expect(deleted.status).toBe(200);

      const after = await api.organizations.post(
        { action: 'get', id: orgId },
        { headers }
      );
      expect(after.status).toBe(404);

      await cleanup();
    });
  });

  // ── Members lifecycle ─────────────────────────────────────
  describe('members lifecycle', () => {
    it('add then list then updateRole then remove', async () => {
      const { headers, cleanup } = await authed('m1@gmail.com');

      const created = await api.organizations.post(
        { action: 'create', name: 'UPT Member', code: 'UPT-MBR' },
        { headers }
      );
      const orgId = (created.data as { id: string }).id;

      const memberUser = test.createUser({ email: 'member@gmail.com' });
      await test.saveUser(memberUser);

      const added = await api.organizations.post(
        {
          action: 'addMember',
          userId: memberUser.id,
          organizationId: orgId,
          roles: ['shop_operator'],
        },
        { headers }
      );
      expect(added.status).toBe(200);

      const listed = await api.organizations.post(
        { action: 'listMembers', organizationId: orgId },
        { headers }
      );
      expect(listed.status).toBe(200);
      expect(listed.data).toHaveLength(1);

      const roleUpdated = await api.organizations.post(
        {
          action: 'updateMemberRole',
          userId: memberUser.id,
          organizationId: orgId,
          roles: ['shop_admin'],
        },
        { headers }
      );
      expect(roleUpdated.status).toBe(200);
      expect((roleUpdated.data as { roles: string[] }).roles).toEqual([
        'shop_admin',
      ]);

      const removed = await api.organizations.post(
        {
          action: 'removeMember',
          userId: memberUser.id,
          organizationId: orgId,
        },
        { headers }
      );
      expect(removed.status).toBe(200);

      const after = await api.organizations.post(
        { action: 'listMembers', organizationId: orgId },
        { headers }
      );
      expect(after.data).toEqual([]);

      await test.deleteUser(memberUser.id);
      await cleanup();
    });

    it('rejects duplicate membership (1 row per user per UPT)', async () => {
      const { headers, cleanup } = await authed('m2@gmail.com');

      const created = await api.organizations.post(
        { action: 'create', name: 'UPT Dup', code: 'UPT-DUP' },
        { headers }
      );
      const orgId = (created.data as { id: string }).id;

      const memberUser = test.createUser({ email: 'dup@gmail.com' });
      await test.saveUser(memberUser);

      const first = await api.organizations.post(
        {
          action: 'addMember',
          userId: memberUser.id,
          organizationId: orgId,
          roles: ['shop_operator'],
        },
        { headers }
      );
      expect(first.status).toBe(200);

      const second = await api.organizations.post(
        {
          action: 'addMember',
          userId: memberUser.id,
          organizationId: orgId,
          roles: ['magang_operator'],
        },
        { headers }
      );
      expect(second.status).not.toBe(200);

      await test.deleteUser(memberUser.id);
      await cleanup();
    });
  });

  // ── Edge cases ────────────────────────────────────────────
  describe('edge cases', () => {
    it('get unknown id returns 404', async () => {
      const { headers, cleanup } = await authed('e1@gmail.com');
      const { status } = await api.organizations.post(
        { action: 'get', id: 'org-not-found' },
        { headers }
      );
      expect(status).toBe(404);
      await cleanup();
    });
  });

  // ── Body validation (422) via treaty ──────────────────────
  describe('body validation (422)', () => {
    it('rejects action outside union', async () => {
      const { headers, cleanup } = await authed('v1@gmail.com');
      const { status } = await api.organizations.post(
        { action: 'invalidAction' } as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });

    it('rejects empty body', async () => {
      const { headers, cleanup } = await authed('v2@gmail.com');
      const { status } = await api.organizations.post(
        {} as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });

    it('rejects create without code', async () => {
      const { headers, cleanup } = await authed('v3@gmail.com');
      const { status } = await api.organizations.post(
        { action: 'create', name: 'No Code' } as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });

    it('rejects wrong types', async () => {
      const { headers, cleanup } = await authed('v4@gmail.com');
      const { status } = await api.organizations.post(
        {
          action: 'create',
          name: 123,
          code: 'UPT-X',
        } as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });

    it('rejects get without id', async () => {
      const { headers, cleanup } = await authed('v5@gmail.com');
      const { status } = await api.organizations.post(
        { action: 'get' } as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });

    it('rejects addMember without roles', async () => {
      const { headers, cleanup } = await authed('v6@gmail.com');
      const { status } = await api.organizations.post(
        {
          action: 'addMember',
          userId: 'u1',
          organizationId: 'o1',
        } as unknown as ActionBody,
        { headers }
      );
      expect(status).toBe(422);
      await cleanup();
    });
  });
});
