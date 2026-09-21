import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { app } from '@/app';
import { auths } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { createMembers } from './utils';

const base = 'http://localhost:3000';

describe('organizations <integrations/services>', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await reset(db, { ...auths, organizations, userOrganizations });
  });

  describe('success ', () => {
    describe('list', () => {
      it('should return correct response', async () => {
        const members = await createMembers(test, 5);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my`, { headers })
        );
        expect(response.status).toBe(200);
        expect((await response.json()).items).toHaveLength(5);
      });

      it('should return correct response with query params', async () => {
        const members = await createMembers(test, 5);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my?limit=2`, { headers })
        );
        expect(response.status).toBe(200);
        expect((await response.json()).items).toHaveLength(2);
      });

      it('should return correct response with next cursor when limit is less than total', async () => {
        const members = await createMembers(test, 5);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my?limit=2`, { headers })
        );
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.items).toHaveLength(2);
        expect(data.nextCursor).toBe(members.members[1].member.id);
      });

      it('should return null nextCursor when all items fit within limit', async () => {
        const members = await createMembers(test, 3);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my?limit=5`, { headers })
        );
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.items).toHaveLength(3);
        expect(data.nextCursor).toBeNull();
      });
    });

    describe('update', () => {
      it('should update member position and roles', async () => {
        const { members } = await createMembers(test, 1);
        const userId = members[0].user.id;

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my/${userId}`, {
            headers: { ...Object.fromEntries(headers.entries()), 'content-type': 'application/json' },
            method: 'PATCH',
            body: JSON.stringify({ position: 'head', roles: ['shop_admin'] }),
          })
        );
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.data.position).toBe('head');
        expect(data.data.roles).toEqual(['shop_admin']);
      });
    });

    describe('delete', () => {
      it('should remove a member', async () => {
        const { members } = await createMembers(test, 1);
        const userId = members[0].user.id;

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my/${userId}`, {
            headers,
            method: 'DELETE',
          })
        );
        expect(response.status).toBe(200);
        expect((await response.json())).toEqual({ success: true });
      });
    });
  });

  describe('validation', () => {
    describe('body validation', () => {
      it('should accept request with body', async () => {
        const { members } = await createMembers(test, 1);
        const headMemberUserId = members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/abc?search=abc`, {
            headers,
            method: 'POST',
          })
        );
        expect(response.status).toBe(200);
      });
    });

    describe('query validation', () => {
      it('should return 422 if wrong query type', async () => {
        const members = await createMembers(test, 1);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/my?limit=invalid`, { headers })
        );
        expect(response.status).toBe(422);
      });

      it('should return 422 if search minLength not met', async () => {
        const members = await createMembers(test, 1);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/abc?search=ab`, {
            headers,
            method: 'POST',
          })
        );
        expect(response.status).toBe(422);
      });

      it('should return 200 if search meets minLength', async () => {
        const members = await createMembers(test, 1);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await app.handle(
          new Request(`${base}/api/organizations/abc?search=abc`, {
            headers,
            method: 'POST',
          })
        );
        expect(response.status).toBe(200);
      });
    });
  });
});
