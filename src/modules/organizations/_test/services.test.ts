import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { reset } from 'drizzle-seed';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { cleanAuthDb } from '@/modules/auth/_test/utils';
import { organizationService } from '@/modules/organizations/service';
import { userServices } from '@/modules/users/service';
import { createMembers, createOrganization } from './utils';

describe('Organization Service', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
    await reset(db, { organizations, userOrganizations });
  });

  describe('getCodeById', () => {
    it('returns the organization code by id', async () => {
      const organization = await createOrganization('Test Org');

      expect(await organizationService.getCodeById(organization.id)).toBe(
        organization.code
      );
    });

    it('returns null when organization does not exist', async () => {
      expect(await organizationService.getCodeById(999999)).toBeNull();
    });
  });

  describe('list members', () => {
    it('lists members with the default limit and next cursor', async () => {
      const { organizationId, members } = await createMembers(test, 3);

      const result = await organizationService.listMembers(
        { organizationId, userId: members[0].user.id },
        { limit: 2 }
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.map((member) => member.id)).toEqual([
        members[0].member.id,
        members[1].member.id,
      ]);
      expect(result.nextCursor).toBe(members[1].member.id);
    });

    it('lists the next page after the cursor', async () => {
      const { organizationId, members } = await createMembers(test, 3);

      const result = await organizationService.listMembers(
        { organizationId, userId: members[0].user.id },
        { cursor: members[1].member.id, limit: 2 }
      );

      expect(result.items.map((member) => member.id)).toEqual([
        members[2].member.id,
      ]);
      expect(result.nextCursor).toBeNull();
    });

    it('returns an empty page for an organization without members', async () => {
      const { id: organizationId } =
        await createOrganization('Empty Organization');

      const result = await organizationService.listMembers(
        { organizationId, userId: randomUUIDv7() },
        {}
      );

      expect(result).toEqual({ items: [], nextCursor: null });
    });

    it('returns null nextCursor when items exactly match the limit', async () => {
      const { organizationId, members } = await createMembers(test, 3);

      const result = await organizationService.listMembers(
        { organizationId, userId: members[0].user.id },
        { limit: 3 }
      );

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeNull();
    });

    it('returns a member detail by user id', async () => {
      const { members } = await createMembers(test, 1);

      expect(
        organizationService.detailMember(members[0].user.id)
      ).resolves.toEqual(members[0].member);
    });

    it('returns null when member does not exist', async () => {
      expect(
        organizationService.detailMember(randomUUIDv7())
      ).resolves.toBeNull();
    });
  });

  describe('addMember', () => {
    it('should add a member and update user metadata', async () => {
      const { organizationId } = await createMembers(test, 1);
      const newUser = test.createUser({ email: 'new@test.com' });
      await test.saveUser(newUser);

      const result = await organizationService.addMember(
        userServices,
        organizationId,
        {
          email: newUser.email,
          position: 'staff',
          roles: ['shop_operator'],
        }
      );

      expect(result).toEqual({ ok: true });

      const member = await organizationService.detailMember(newUser.id);
      expect(member).not.toBeNull();
      expect(member?.position).toBe('staff');
      expect(member?.roles).toEqual(['shop_operator']);
    });

    it('should return USER_NOT_FOUND when email does not exist', async () => {
      const { id: organizationId } = await createOrganization('Test Org');

      const result = await organizationService.addMember(
        userServices,
        organizationId,
        {
          email: 'nonexistent@test.com',
          position: 'staff',
          roles: ['shop_operator'],
        }
      );

      expect(result).toEqual({ ok: false, code: 'USER_NOT_FOUND' });
    });

    it('should return MEMBER_ALREADY_EXISTS when user is already a member', async () => {
      const { organizationId, members } = await createMembers(test, 1);

      const result = await organizationService.addMember(
        userServices,
        organizationId,
        {
          email: members[0].user.email,
          position: 'head',
          roles: ['shop_admin'],
        }
      );

      expect(result).toEqual({ ok: false, code: 'MEMBER_ALREADY_EXISTS' });
    });
  });

  describe('updateMember', () => {
    it('should update member position and roles', async () => {
      const { organizationId, members } = await createMembers(test, 1);
      const userId = members[0].user.id;

      const result = await organizationService.updateMember(
        userId,
        organizationId,
        { position: 'head', roles: ['shop_admin'] }
      );
      expect(result).not.toBeNull();
      expect(result?.position).toBe('head');
      expect(result?.roles).toEqual(['shop_admin']);
    });

    it('should return null when updating non-existent member', async () => {
      const { id: organizationId } = await createOrganization('Test Org');

      const result = await organizationService.updateMember(
        randomUUIDv7(),
        organizationId,
        { position: 'staff' }
      );
      expect(result).toBeNull();
    });

    it('should return null when member belongs to another organization', async () => {
      const firstOrganization = await createMembers(test, 1);
      const secondOrganization = await createMembers(test, 1);
      const member = secondOrganization.members[0];

      const result = await organizationService.updateMember(
        member.user.id,
        firstOrganization.organizationId,
        { position: 'staff' }
      );

      expect(result).toBeNull();
      expect(await organizationService.detailMember(member.user.id)).toEqual(
        member.member
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a member from the organization', async () => {
      const { organizationId, members } = await createMembers(test, 1);
      const userId = members[0].user.id;

      const result = await organizationService.removeMember(
        userId,
        organizationId
      );
      expect(result).toBe(true);
      expect(await organizationService.isMemberExist(userId)).toBe(false);
    });

    it('should return false when member does not exist', async () => {
      const { id: organizationId } = await createOrganization('Test Org');

      const result = await organizationService.removeMember(
        randomUUIDv7(),
        organizationId
      );

      expect(result).toBe(false);
    });

    it('should return false when member belongs to another organization', async () => {
      const firstOrganization = await createMembers(test, 1);
      const secondOrganization = await createMembers(test, 1);
      const member = secondOrganization.members[0];

      const result = await organizationService.removeMember(
        member.user.id,
        firstOrganization.organizationId
      );

      expect(result).toBe(false);
      expect(await organizationService.isMemberExist(member.user.id)).toBe(
        true
      );
    });
  });

  describe('isMemberExist', () => {
    it('should return true when user is a member', async () => {
      const { members } = await createMembers(test, 1);
      const userId = members[0].user.id;

      const result = await organizationService.isMemberExist(userId);
      expect(result).toBe(true);
    });

    it('should return false when user is not a member', async () => {
      await createOrganization('Test Org');
      const user = test.createUser();
      await test.saveUser(user);

      const result = await organizationService.isMemberExist(user.id);
      expect(result).toBe(false);
    });
  });
});
