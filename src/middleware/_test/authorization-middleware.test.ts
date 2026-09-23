import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import { Elysia } from 'elysia';
import { env } from '@/constants/env';
import { auths, users } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { createMemberUser } from '@/modules/admin/organizations/_test/utils';
import { adminHeaders, createUser } from '@/modules/auth/_test/utils';
import {
  type AuthorizationRequirement,
  authorizationMiddleware,
} from '../authorization-middleware';

describe('authorizatioin-middleware.test.ts', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await reset(db, { ...auths, organizations, userOrganizations });
  });

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
    const { headers } = await test.login({ userId: user.id });
    return headers;
  }

  const kindRoute = (requirement: AuthorizationRequirement) =>
    new Elysia()
      .use(authorizationMiddleware)
      .get('/dummy-kind-route', () => ({ ok: true }), {
        authorize: requirement,
      });

  const kindOrgRoute = (requirement: AuthorizationRequirement) =>
    new Elysia()
      .use(authorizationMiddleware)
      .get('/dummy-kind-org-route', () => ({ ok: true }), {
        authorize: requirement,
      });

  describe('user.metadata.kind admin success', () => {
    const dummyKindRoute = `${env.APP_URL}/dummy-kind-route`;

    it('should success if authorization only need kind admin', async () => {
      const headers = await adminHeaders(
        test,
        `mw-admin-${Date.now()}@gmail.com`
      );

      const res = await kindRoute({ kinds: ['admin'] }).handle(
        new Request(dummyKindRoute, { headers })
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe('user.metadata.kind organization success', () => {
    it('should return 200 when kind organization roles and position in request body and user has matching roles and position', async () => {
      const headers = await memberHeaders({
        email: `mw-org-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_operator'],
      });

      const res = await kindOrgRoute({
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_operator'],
      }).handle(
        new Request(`${env.APP_URL}/dummy-kind-org-route`, { headers })
      );
      expect(res.status).toBe(200);
    });
  });

  describe('error', () => {
    it('should return 403 when kind organization but user not in organization', async () => {
      const user = await createUser(test, `mw-no-org-${Date.now()}@gmail.com`);
      await db
        .update(users)
        .set({ metadata: { kind: 'organization' } })
        .where(eq(users.id, user.id));
      const { headers } = await test.login({ userId: user.id });

      const res = await kindOrgRoute({
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_operator'],
      }).handle(
        new Request(`${env.APP_URL}/dummy-kind-org-route`, { headers })
      );
      expect(res.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('should return 422 when kind organization roles but no position in request body', async () => {
      const headers = await memberHeaders({
        email: `mw-role-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_operator'],
      });

      const res = await kindOrgRoute({
        kinds: ['organization'],
        roles: ['shop_operator'],
      }).handle(
        new Request(`${env.APP_URL}/dummy-kind-org-route`, { headers })
      );
      expect(res.status).toBe(422);
    });

    it('should return 422 when kind organization position but no roles in request body', async () => {
      const headers = await memberHeaders({
        email: `mw-pos-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_operator'],
      });

      const res = await kindOrgRoute({
        kinds: ['organization'],
        positions: ['head'],
      }).handle(
        new Request(`${env.APP_URL}/dummy-kind-org-route`, { headers })
      );
      expect(res.status).toBe(422);
    });

    it('should return 422 when kind organization but no position/roles in request body', async () => {
      const headers = await memberHeaders({
        email: `mw-no-pos-${Date.now()}@gmail.com`,
        position: 'head',
        roles: ['shop_operator'],
      });

      const res = await kindOrgRoute({
        kinds: ['organization'],
      }).handle(
        new Request(`${env.APP_URL}/dummy-kind-org-route`, { headers })
      );
      expect(res.status).toBe(422);
    });

    it('should return 422 when kind admin but position/roles in request body', async () => {
      const headers = await adminHeaders(
        test,
        `mw-admin-role-${Date.now()}@gmail.com`
      );

      const res = await kindRoute({
        kinds: ['admin'],
        positions: ['head'],
        roles: ['shop_operator'],
      }).handle(new Request(`${env.APP_URL}/dummy-kind-route`, { headers }));
      expect(res.status).toBe(422);
    });

    it('should return 401 if no session', async () => {
      const res = await kindRoute({ kinds: ['admin'] }).handle(
        new Request(`${env.APP_URL}/dummy-kind-route`)
      );
      expect(res.status).toBe(401);
    });
  });
});
