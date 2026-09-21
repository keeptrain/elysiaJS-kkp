import { beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { reset } from 'drizzle-seed';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { cleanAuthDb } from '@/modules/auth/_test/utils';
import { userServices } from '@/modules/users/service';
import { organizationService } from '@/modules/organizations/service';
import { createMembers, createOrganization } from './utils';

describe('Organization Service', () => {
  let test: TestHelpers;

  beforeEach(async () => {
    test = (await auth.$context).test;
    await cleanAuthDb();
    await reset(db, { organizations, userOrganizations });
  });

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

  it('returns a member detail by user id', async () => {
    const { members } = await createMembers(test, 1);

    expect(
      organizationService.detailMember(members[0].user.id)
    ).resolves.toEqual(members[0].member);
  });

  describe('addMember', () => {
    it('should add a member and update user metadata', async () => {
      const { organizationId } = await createMembers(test, 1);
      const newUser = test.createUser({ email: 'new@test.com' });
      await test.saveUser(newUser);

      await organizationService.addMember(userServices, organizationId, {
        email: newUser.email,
        position: 'staff',
        roles: ['shop_operator'],
      });

      const member = await organizationService.detailMember(newUser.id);
      expect(member).not.toBeNull();
      expect(member!.position).toBe('staff');
      expect(member!.roles).toEqual(['shop_operator']);
    });

    it('should throw USER_NOT_FOUND when email does not exist', async () => {
      const { organizationId } = await createOrganization('Test Org');

      await expect(
        organizationService.addMember(userServices, organizationId, {
          email: 'nonexistent@test.com',
          position: 'staff',
          roles: ['shop_operator'],
        })
      ).rejects.toThrow('USER_NOT_FOUND');
    });

    it('should throw MEMBER_ALREADY_EXISTS when user is already a member', async () => {
      const { organizationId, members } = await createMembers(test, 1);

      await expect(
        organizationService.addMember(userServices, organizationId, {
          email: members[0].user.email,
          position: 'head',
          roles: ['shop_admin'],
        })
      ).rejects.toThrow('MEMBER_ALREADY_EXISTS');
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
      const { id: organizationId } = await createOrganization('Test Org');
      const user = test.createUser();
      await test.saveUser(user);

      const result = await organizationService.isMemberExist(user.id);
      expect(result).toBe(false);
    });
  });
});
