import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { treaty } from '@elysia/eden';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { app } from '@/app';
import { auths } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import type { OrganizationsAction } from '@/modules/admin/organizations';
import { createAdminUser } from '@/modules/auth/_test/utils';

const api = treaty(app).api;
type ActionBody = OrganizationsAction;

describe('admin organizations integrations', () => {
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

  async function adminHeaders(email = 'admin@gmail.com') {
    const user = await createAdminUser(test, email);
    const rawHeaders = await test.getAuthHeaders({ userId: user.id });
    return Object.fromEntries(rawHeaders.entries());
  }

  describe('success', () => {
    describe('POST /organizations action=list', () => {
      it('should return an empty list when organizations do not exist', async () => {
        const headers = await adminHeaders();
        const response = await api.organizations.post(
          { action: 'list' },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data).toEqual([]);
      });

      it('should return organizations matching the search query', async () => {
        const headers = await adminHeaders();
        await api.organizations.post(
          { action: 'create', name: 'UPT Sehat', code: 'UPT-SEHAT' },
          { headers }
        );
        await api.organizations.post(
          { action: 'create', name: 'UPT Pendidikan', code: 'UPT-PENDIDIKAN' },
          { headers }
        );

        const response = await api.organizations.post(
          { action: 'list', filters: { search: 'Sehat' } },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveLength(1);
        expect((response.data as { name: string }[])[0]?.name).toBe(
          'UPT Sehat'
        );
      });
    });

    describe('POST /organizations action=create', () => {
      it('should create and return an organization', async () => {
        const headers = await adminHeaders();
        const response = await api.organizations.post(
          { action: 'create', name: 'UPT Test', code: 'UPT-TEST' },
          { headers }
        );

        expect(response.status).toBe(200);
        const data = response.data as {
          id: string;
          name: string;
          code: string;
        };
        expect(data.name).toBe('UPT Test');
        expect(data.code).toBe('UPT-TEST');
        expect(data.id).toBeDefined();
      });
    });

    describe('POST /organizations action=get', () => {
      it('should return an organization by id', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Test', code: 'UPT-GET' },
          { headers }
        );

        const response = await api.organizations.post(
          { action: 'get', id: (created.data as { id: string }).id },
          { headers }
        );

        expect(response.status).toBe(200);
        expect((response.data as { id: string }).id).toBe(
          (created.data as { id: string }).id
        );
      });
    });

    describe('POST /organizations action=update', () => {
      it('should update organization fields', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'Old Name', code: 'UPT-UPDATE' },
          { headers }
        );

        const response = await api.organizations.post(
          {
            action: 'update',
            id: (created.data as { id: string }).id,
            name: 'New Name',
          },
          { headers }
        );

        expect(response.status).toBe(200);
        const data = response.data as { name: string; code: string };
        expect(data.name).toBe('New Name');
        expect(data.code).toBe('UPT-UPDATE');
      });
    });

    describe('POST /organizations action=delete', () => {
      it('should delete an organization', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Delete', code: 'UPT-DELETE' },
          { headers }
        );

        const response = await api.organizations.post(
          { action: 'delete', id: (created.data as { id: string }).id },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ success: true });
      });
    });

    describe('POST /organizations action=listMembers', () => {
      it('should return members in an organization', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Members', code: 'UPT-MEMBERS' },
          { headers }
        );
        const member = test.createUser({ email: 'member@gmail.com' });
        await test.saveUser(member);
        await api.organizations.post(
          {
            action: 'addMember',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
            roles: ['shop_operator'],
          },
          { headers }
        );

        const response = await api.organizations.post(
          {
            action: 'listMembers',
            organizationId: (created.data as { id: string }).id,
          },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data).toHaveLength(1);
        expect((response.data as { userId: string }[])[0]?.userId).toBe(
          member.id
        );
      });
    });

    describe('POST /organizations action=addMember', () => {
      it('should add a member to an organization', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Add', code: 'UPT-ADD' },
          { headers }
        );
        const member = test.createUser({ email: 'add-member@gmail.com' });
        await test.saveUser(member);

        const response = await api.organizations.post(
          {
            action: 'addMember',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
            position: 'staff',
            roles: ['shop_operator'],
          },
          { headers }
        );

        expect(response.status).toBe(200);
        const data = response.data as { userId: string; roles: string[] };
        expect(data.userId).toBe(member.id);
        expect(data.roles).toEqual(['shop_operator']);
      });
    });

    describe('POST /organizations action=updateMemberRole', () => {
      it('should update member roles', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Role', code: 'UPT-ROLE' },
          { headers }
        );
        const member = test.createUser({ email: 'role-member@gmail.com' });
        await test.saveUser(member);
        await api.organizations.post(
          {
            action: 'addMember',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
            roles: ['shop_operator'],
          },
          { headers }
        );

        const response = await api.organizations.post(
          {
            action: 'updateMemberRole',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
            roles: ['shop_admin'],
          },
          { headers }
        );

        expect(response.status).toBe(200);
        expect((response.data as { roles: string[] }).roles).toEqual([
          'shop_admin',
        ]);
      });
    });

    describe('POST /organizations action=removeMember', () => {
      it('should remove a member from an organization', async () => {
        const headers = await adminHeaders();
        const created = await api.organizations.post(
          { action: 'create', name: 'UPT Remove', code: 'UPT-REMOVE' },
          { headers }
        );
        const member = test.createUser({ email: 'remove-member@gmail.com' });
        await test.saveUser(member);
        await api.organizations.post(
          {
            action: 'addMember',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
            roles: ['shop_operator'],
          },
          { headers }
        );

        const response = await api.organizations.post(
          {
            action: 'removeMember',
            userId: member.id,
            organizationId: (created.data as { id: string }).id,
          },
          { headers }
        );

        expect(response.status).toBe(200);
        expect(response.data).toEqual({ success: true });
      });
    });
  });

  describe('validation', () => {
    it('should return 422 for an unsupported action', async () => {
      const headers = await adminHeaders();
      const response = await api.organizations.post(
        { action: 'invalid' } as unknown as ActionBody,
        { headers }
      );

      expect(response.status).toBe(422);
    });

    it('should return 422 when create fields are missing', async () => {
      const headers = await adminHeaders();
      const response = await api.organizations.post(
        { action: 'create', name: 'UPT Missing Code' } as unknown as ActionBody,
        { headers }
      );

      expect(response.status).toBe(422);
    });

    it('should return 422 when addMember roles are missing', async () => {
      const headers = await adminHeaders();
      const response = await api.organizations.post(
        {
          action: 'addMember',
          userId: 'user-id',
          organizationId: 'organization-id',
        } as unknown as ActionBody,
        { headers }
      );

      expect(response.status).toBe(422);
    });
  });

  describe('error', () => {
    it('should return 404 when organization does not exist', async () => {
      const headers = await adminHeaders();
      const response = await api.organizations.post(
        { action: 'get', id: 'organization-not-found' },
        { headers }
      );

      expect(response.status).toBe(404);
      expect(response.error?.value).toEqual({
        message: 'Organization not found',
      });
    });

    it('should return 404 when updating organization does not exist', async () => {
      const headers = await adminHeaders();
      const response = await api.organizations.post(
        {
          action: 'update',
          id: 'organization-not-found',
          name: 'New Name',
        },
        { headers }
      );

      expect(response.status).toBe(404);
    });
  });
});
