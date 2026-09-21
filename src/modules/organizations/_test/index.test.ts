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

        const response = await api.organizations.my.get(
          { headers },
          {}
        );
        expect(response.status).toBe(200);
        expect(response.data.items).toHaveLength(5);
      });

      it('should return correct response with query params', async () => {
        const members = await createMembers(test, 5);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await api.organizations.my.get(
          { query: { limit: 2 }, headers },
          {}
        );
        expect(response.status).toBe(200);
        expect(response.data.items).toHaveLength(2);
      });

      it('should return correct response with next cursor when limit is less than total', async () => {
        const members = await createMembers(test, 5);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await api.organizations.my.get(
          { query: { limit: 2 }, headers },
          {}
        );
        expect(response.status).toBe(200);
        expect(response.data.items).toHaveLength(2);
        expect(response.data.nextCursor).toBe(members.members[1].member.id);
      });

      it('should return null nextCursor when all items fit within limit', async () => {
        const members = await createMembers(test, 3);
        const headMemberUserId = members.members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await api.organizations.my.get(
          { query: { limit: 5 }, headers },
          {}
        );
        expect(response.status).toBe(200);
        expect(response.data.items).toHaveLength(3);
        expect(response.data.nextCursor).toBeNull();
      });
    });

    describe('add member', () => {
      it('should add a member', async () => {
        const { members } = await createMembers(test, 1);
        const newUser = test.createUser({ email: 'new@test.com' });
        await test.saveUser(newUser);

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my.add.post(
          { email: newUser.email, position: 'staff' },
          { headers }
        );
        expect(response.status).toBe(200);
      });
    });

    describe('update', () => {
      it('should update member position and roles', async () => {
        const { members } = await createMembers(test, 1);
        const userId = members[0].user.id;

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my({ memberId: userId }).patch(
          { position: 'head', roles: ['shop_admin'] },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data?.data?.position).toBe('head');
        expect(response.data?.data?.roles).toEqual(['shop_admin']);
      });
    });

    describe('delete', () => {
      it('should remove a member', async () => {
        const { members } = await createMembers(test, 1);
        const userId = members[0].user.id;

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my({ memberId: userId }).delete(
          {},
          { headers }
        );
        expect(response.status).toBe(200);
        expect(response.data).toEqual({ success: true });
      });
    });
  });

  describe('validation', () => {
    describe('body validation', () => {
      it('should return 422 if add member email is too short', async () => {
        const { members } = await createMembers(test, 1);
        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my.add.post(
          { email: 'ab', position: 'staff' },
          { headers }
        );
        expect(response.status).toBe(422);
      });

      it('should return 422 if update body has invalid position', async () => {
        const { members } = await createMembers(test, 1);
        const userId = members[0].user.id;

        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my({ memberId: userId }).patch(
          { position: 'invalid_position' },
          { headers }
        );
        expect(response.status).toBe(422);
      });

      it('should return 422 if add member has missing required fields', async () => {
        const { members } = await createMembers(test, 1);
        const { headers } = await test.login({
          userId: members[0].user.id,
        });

        const response = await api.organizations.my.add.post(
          { position: 'staff' },
          { headers }
        );
        expect(response.status).toBe(422);
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

        const response = await api.organizations.my.get(
          { query: { limit: 'invalid' as unknown as number }, headers },
          {}
        );
        expect(response.status).toBe(422);
      });

      it('should return 422 if search minLength not met', async () => {
        const { members } = await createMembers(test, 1);
        const headMemberUserId = members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await api.organizations.abc.post(
          {},
          { query: { search: 'ab' }, headers }
        );
        expect(response.status).toBe(422);
      });

      it('should return 200 if search meets minLength', async () => {
        const { members } = await createMembers(test, 1);
        const headMemberUserId = members.find(
          (m) => m.member.position === 'head'
        )?.user.id;

        const { headers } = await test.login({
          userId: headMemberUserId as string,
        });

        const response = await api.organizations.abc.post(
          {},
          { query: { search: 'abc' }, headers }
        );
        expect(response.status).toBe(200);
      });
    });
  });
});
