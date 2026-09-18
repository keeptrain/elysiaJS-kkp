import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia } from 'elysia';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { auth } from '@/lib/auth';
import { users } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import {
  authMiddleware,
  kindMiddleware,
  organizationMiddleware,
  type KindRequirement,
  type OrgRequirement,
} from '@/middleware/auth-middleware';
import { cleanAuthDb } from '@/modules/auth/_test/utils';

const base = 'http://localhost:3000';

describe('kind + organization macro', () => {
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

  async function memberHeaders(opts: {
    email: string;
    position?: string;
    roles?: string[];
    kind?: 'admin' | 'organization';
  }) {
    const user = test.createUser({ email: opts.email });
    await test.saveUser(user);
    if (opts.kind) {
      await db
        .update(users)
        .set({ metadata: { kind: opts.kind } })
        .where(eq(users.id, user.id));
    }
    if (opts.roles) {
      const [org] = await db
        .insert(organizations)
        .values({
          id: randomUUIDv7(),
          name: 'UPT MW',
          code: `UPTMW-${Date.now()}-${Math.random()}`,
        })
        .returning();
      await db.insert(userOrganizations).values({
        id: randomUUIDv7(),
        userId: user.id,
        organizationId: org.id,
        position: opts.position ?? 'staff',
        roles: opts.roles,
      });
    }
    return test.getAuthHeaders({ userId: user.id });
  }

  function kindRoute(requirement: KindRequirement) {
    return new Elysia()
      .use(authMiddleware)
      .use(kindMiddleware)
      .get('/mw', () => ({ ok: true }), { kind: requirement });
  }

  function orgRoute(requirement: OrgRequirement = {}) {
    return new Elysia()
      .use(authMiddleware)
      .use(organizationMiddleware)
      .get('/mw', ({ session }) => ({ organization: session.organization }), {
        org: requirement,
      });
  }

  // ── Kind macro ────────────────────────────────────────────
  describe('kind macro', () => {
    it('200 untuk admin di kinds admin', async () => {
      const headers = await memberHeaders({
        email: `mw-admin-${Date.now()}@gmail.com`,
        kind: 'admin',
      });
      const res = await kindRoute({ kinds: ['admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('200 untuk member di kinds organization', async () => {
      const headers = await memberHeaders({
        email: `mw-org-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });
      const res = await kindRoute({ kinds: ['organization'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(200);
    });

    it('403 member di kinds admin', async () => {
      const headers = await memberHeaders({
        email: `mw-deny-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });
      const res = await kindRoute({ kinds: ['admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('401 tanpa session', async () => {
      const res = await kindRoute({ kinds: ['admin'] }).handle(
        new Request(`${base}/mw`)
      );
      expect(res.status).toBe(401);
    });
  });

  // ── Org macro ─────────────────────────────────────────────
  describe('org macro', () => {
    it('200 + organization untuk member', async () => {
      const headers = await memberHeaders({
        email: `mw-base-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });
      const res = await orgRoute().handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        organization: { position: string };
      };
      expect(json.organization.position).toBe('staff');
    });

    it('200 untuk head di positions head', async () => {
      const headers = await memberHeaders({
        email: `mw-head-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_admin'],
      });
      const res = await orgRoute({ positions: ['head'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(200);
    });

    it('200 untuk role yang cocok', async () => {
      const headers = await memberHeaders({
        email: `mw-role-${Date.now()}@gmail.com`,
        roles: ['shop_admin'],
      });
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(200);
    });

    it('403 admin tanpa membership (tanpa bypass)', async () => {
      const headers = await memberHeaders({
        email: `mw-nobypass-${Date.now()}@gmail.com`,
        kind: 'admin',
      });
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('401 tanpa session', async () => {
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(`${base}/mw`)
      );
      expect(res.status).toBe(401);
    });

    it('403 staff di positions head', async () => {
      const headers = await memberHeaders({
        email: `mw-staff-${Date.now()}@gmail.com`,
        position: 'staff',
        roles: ['shop_operator'],
      });
      const res = await orgRoute({ positions: ['head'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('403 role tidak cocok', async () => {
      const headers = await memberHeaders({
        email: `mw-norole-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('403 tanpa membership saat roles disyaratkan', async () => {
      const headers = await memberHeaders({
        email: `mw-nomember-${Date.now()}@gmail.com`,
      });
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(`${base}/mw`, { headers })
      );
      expect(res.status).toBe(403);
    });
  });
});
