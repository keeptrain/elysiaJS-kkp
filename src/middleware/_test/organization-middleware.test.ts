import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { Elysia } from 'elysia';
import { auth } from '@/lib/auth';
import { betterAuth } from '@/middleware/auth-middleware';
import { adminHeaders, cleanAuthDb } from '@/modules/auth/_test/utils';
import {
  cleanOrgDb,
  createMemberUser,
} from '@/modules/admin/organizations/_test/utils';
import { env } from '@/constants/env';
import {
  authorizationMiddleware,
  type AuthorizationRequirement,
} from '../authorization-middleware';

describe('organization-middleware.test.ts', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
    await cleanOrgDb();
  });

  // Member UPT + headers sesi. Admin pusat pakai adminHeaders.
  async function memberHeaders(opts: {
    email: string;
    position?: string;
    roles?: string[];
  }) {
    const { user } = await createMemberUser(test, {
      email: opts.email,
      position: opts.position,
      roles: opts.roles ?? [],
    });
    return test.getAuthHeaders({ userId: user.id });
  }

  // ── Kind macro ────────────────────────────────────────────
  describe('', () => {
    const dummyKindRoute = `${env.APP_URL}/dummy-kind-route`;

    function kindRoute(requirement: AuthorizationRequirement) {
      return new Elysia()
        .use(betterAuth)
        .use(authorizationMiddleware)
        .get('/dummy-kind-route', () => ({ ok: true }), {
          authorize: requirement,
          auth: true,
        });
    }

    // it('200 untuk admin di kinds admin', async () => {
    //   const headers = await adminHeaders(
    //     test,
    //     `mw-admin-${Date.now()}@gmail.com`
    //   );
    //   const res = await kindRoute({ kinds: ['admin'] }).handle(
    //     new Request(`${base}/mw`, { headers })
    //   );
    //   expect(res.status).toBe(200);
    //   expect(await res.json()).toEqual({ ok: true });
    // });
    // it('200 untuk member di kinds organization', async () => {
    //   const headers = await memberHeaders({
    //     email: `mw-org-${Date.now()}@gmail.com`,
    //     roles: ['shop_operator'],
    //   });
    //   const res = await kindRoute({ kinds: ['organization'] }).handle(
    //     new Request(`${base}/mw`, { headers })
    //   );
    //   expect(res.status).toBe(200);
    // });
    // it('403 member di kinds admin', async () => {
    //   const headers = await memberHeaders({
    //     email: `mw-deny-${Date.now()}@gmail.com`,
    //     roles: ['shop_operator'],
    //   });
    //   const res = await kindRoute({ kinds: ['admin'] }).handle(
    //     new Request(`${base}/mw`, { headers })
    //   );
    //   expect(res.status).toBe(403);
    // });
    // it('401 tanpa session', async () => {
    //   const res = await kindRoute({ kinds: ['admin'] }).handle(
    //     new Request(`${base}/mw`)
    //   );
    //   expect(res.status).toBe(401);
    // });
  });

  // ── Org macro ─────────────────────────────────────────────
  describe('organization-middleware', () => {
    const dummyOrgRoute = `${env.APP_URL}/dummy-org-route`;

    function orgRoute(requirement: AuthorizationRequirement = {}) {
      return new Elysia()
        .use(betterAuth)
        .use(authorizationMiddleware)
        .get('/dummy-org-route', () => ({ ok: true }), {
          auth: true,
          authorize: requirement,
        });
    }

    it('200 organization', async () => {
      const headers = await memberHeaders({
        email: `mw-base-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });
      const res = await orgRoute().handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('200 when head organization has any roles', async () => {
      const headers = await memberHeaders({
        email: `mw-head-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_admin'],
      });
      const res = await orgRoute({ positions: ['head'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(200);
    });

    it('200 matching roles', async () => {
      const headers = await memberHeaders({
        email: `mw-role-${Date.now()}@gmail.com`,
        roles: ['shop_admin'],
      });
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(200);
    });

    it('401 without session betterAuth', async () => {
      const res = await orgRoute().handle(new Request(dummyOrgRoute));
      expect(res.status).toBe(401);
    });

    it('403 when admin without membership (without bypass)', async () => {
      const headers = await adminHeaders(
        test,
        `mw-nobypass-${Date.now()}@gmail.com`
      );
      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('403 when position staff on roles shop_operator', async () => {
      const headers = await memberHeaders({
        email: `mw-staff-${Date.now()}@gmail.com`,
        position: 'staff',
        roles: ['shop_operator'],
      });
      const res = await orgRoute({ positions: ['head'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('403 when not matching roles', async () => {
      const headers = await memberHeaders({
        email: `mw-norole-${Date.now()}@gmail.com`,
        roles: ['shop_operator'],
      });

      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(403);
    });

    it('403 when roles asserted but positions not', async () => {
      const headers = await memberHeaders({
        email: `mw-nomember-${Date.now()}@gmail.com`,
      });

      const res = await orgRoute({ roles: ['shop_admin'] }).handle(
        new Request(dummyOrgRoute, { headers })
      );
      expect(res.status).toBe(403);
    });
  });
});
