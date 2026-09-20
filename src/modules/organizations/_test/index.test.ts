import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { treaty } from '@elysia/eden';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { app } from '@/app';
import { auths } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { createMembers } from './utils';

const api = treaty(app).api;

describe('Organization Integration', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await reset(db, { ...auths, organizations, userOrganizations });
  });

  describe('success - organization users', () => {
    it('should return correct response', async () => {
      const members = await createMembers(test, 5);
      const headMemberUserId = members.members.find(
        (m) => m.member.position === 'head'
      )?.user.id;

      // Simulate a request to the API with the head member's auth headers
      const authHeaders = await test.getAuthHeaders({
        userId: headMemberUserId as string,
      });

      const response = await api.organizations.my.get({
        headers: authHeaders,
      });
      expect(response.status).toBe(200);
      expect(response.data?.items).toHaveLength(5);
    });
  });

  describe('Authorization', () => {
    it('should return 403 if user is not a head position in organization', async () => {
      const response = await api.organizations.abc.post(
        {},
        { query: { search: 't' } }
      );

      console.log(response);
    });
  });

  describe('Validation', () => {
    it('should return 422 if wrong query type', async () => {});
  });
});
