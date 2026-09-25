import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { auths } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { organizationService } from '@/modules/admin/organizations/service';
import { createMemberUser } from './utils';

describe('Admin Organization Service', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await reset(db, {
      ...auths,
      organizations,
      userOrganizations,
    });
  });

  describe('list', () => {
    it('should return all organizations ordered by newest first', async () => {
      const first = await organizationService.create({
        name: 'First Organization',
        code: 'ORG-FIRST',
      });
      const second = await organizationService.create({
        name: 'Second Organization',
        code: 'ORG-SECOND',
      });

      const result = await organizationService.list();

      expect(result.map((organization) => organization.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it('should return organizations matching the search filter', async () => {
      await organizationService.create({
        name: 'Health Office',
        code: 'ORG-HEALTH',
      });
      await organizationService.create({
        name: 'Education Office',
        code: 'ORG-EDUCATION',
      });

      const result = await organizationService.list({ search: 'Health' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Health Office');
    });
  });

  describe('getById', () => {
    it('should return an organization when it exists', async () => {
      const created = await organizationService.create({
        name: 'Test Organization',
        code: 'ORG-GET',
      });

      const result = await organizationService.getById(created.id);

      expect(result).toEqual(created);
    });

    it('should return null when organization does not exist', async () => {
      const result = await organizationService.getById(
        'organization-not-found'
      );

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const result = await organizationService.create({
        name: 'Created Organization',
        code: 'ORG-CREATE',
      });

      expect(result.name).toBe('Created Organization');
      expect(result.code).toBe('ORG-CREATE');
      expect(result.id).toBeDefined();
    });

    it('should generate code from organization name when code is omitted', async () => {
      const result = await organizationService.create({
        name: 'Kantor Kelurahan',
      });

      expect(result.code).toBe('KK');
    });
  });

  describe('update', () => {
    it('should update only the provided fields', async () => {
      const created = await organizationService.create({
        name: 'Old Name',
        code: 'ORG-UPDATE',
      });

      const result = await organizationService.update(created.id, {
        name: 'New Name',
      });

      expect(result?.name).toBe('New Name');
      expect(result?.code).toBe('ORG-UPDATE');
    });

    it('should return null when organization does not exist', async () => {
      const result = await organizationService.update(
        'organization-not-found',
        { name: 'New Name' }
      );

      expect(result).toBeNull();
    });

    it('should regenerate code when organization name changes without code', async () => {
      const created = await organizationService.create({
        name: 'Kantor Kelurahan',
      });

      const result = await organizationService.update(created.id, {
        name: 'Dinas Kesehatan',
      });

      expect(result?.name).toBe('Dinas Kesehatan');
      expect(result?.code).toBe('DK');
    });
  });

  describe('delete', () => {
    it('should delete an organization', async () => {
      const created = await organizationService.create({
        name: 'Delete Organization',
        code: 'ORG-DELETE',
      });

      const result = await organizationService.delete(created.id);

      expect(result).toEqual({ success: true });
      expect(await organizationService.getById(created.id)).toBeNull();
    });
  });

  describe('listMembers', () => {
    it('should return members for an organization', async () => {
      const { org } = await createMemberUser(test, {
        email: 'list-member@gmail.com',
        roles: ['shop_operator'],
      });

      const result = await organizationService.listMembers(org.id);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBeDefined();
      expect(result[0].organizationId).toBe(org.id);
    });

    it('should return an empty list when organization has no members', async () => {
      const organization = await organizationService.create({
        name: 'Empty Organization',
        code: 'ORG-EMPTY',
      });

      const result = await organizationService.listMembers(organization.id);

      expect(result).toEqual([]);
    });
  });

  describe('addMember', () => {
    it('should add a member to an organization', async () => {
      const organization = await organizationService.create({
        name: 'Add Member Organization',
        code: 'ORG-ADD',
      });
      const user = test.createUser({ email: 'add-service@gmail.com' });
      await test.saveUser(user);

      const result = await organizationService.addMember({
        userId: user.id,
        organizationId: organization.id,
        position: 'staff',
        roles: ['shop_operator'],
      });

      expect(result.userId).toBe(user.id);
      expect(result.organizationId).toBe(organization.id);
      expect(result.roles).toEqual(['shop_operator']);
    });
  });

  describe('updateMemberRole', () => {
    it('should update roles for an existing member', async () => {
      const { user, org } = await createMemberUser(test, {
        email: 'update-role@gmail.com',
        roles: ['shop_operator'],
      });

      const result = await organizationService.updateMemberRole(
        user.id,
        org.id,
        ['shop_admin']
      );

      expect(result?.roles).toEqual(['shop_admin']);
    });

    it('should return null when member does not exist', async () => {
      const organization = await organizationService.create({
        name: 'Role Organization',
        code: 'ORG-ROLE',
      });

      const result = await organizationService.updateMemberRole(
        'user-not-found',
        organization.id,
        ['shop_admin']
      );

      expect(result).toBeNull();
    });
  });

  describe('removeMember', () => {
    it('should remove an existing member', async () => {
      const { user, org } = await createMemberUser(test, {
        email: 'remove-member@gmail.com',
        roles: ['shop_operator'],
      });

      const result = await organizationService.removeMember(user.id, org.id);

      expect(result).toEqual({ success: true });
      expect(await organizationService.listMembers(org.id)).toEqual([]);
    });

    it('should return success when member does not exist', async () => {
      const organization = await organizationService.create({
        name: 'Remove Organization',
        code: 'ORG-REMOVE',
      });

      const result = await organizationService.removeMember(
        'user-not-found',
        organization.id
      );

      expect(result).toEqual({ success: true });
    });
  });
});
