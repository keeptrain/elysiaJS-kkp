import Elysia, { status } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { userModule } from '../users';
import {
  AddMemberBody,
  CursorPaginationQuery,
  UpdateMemberBody,
} from './model';
import { organizationService } from './service';

export interface OrganizationContract {
  getCodeById: (id: number) => Promise<string | null>;
  getSummaryById: (
    id: number
  ) => Promise<{ id: number; name: string; code: string } | null>;
}

export const organizationModule: OrganizationContract = {
  async getCodeById(id: number) {
    return organizationService.getCodeById(id);
  },
  async getSummaryById(id: number) {
    return organizationService.getSummaryById(id);
  },
};

export const organizationRoutes = new Elysia({
  prefix: '/organizations',
  detail: { tags: ['organizations'], hide: true },
})
  .use(betterAuth)
  .use(authorizationMiddleware)
  .get(
    'my',
    async ({ query, user: { id: userId }, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const res = await organizationService.listMembers(
        { organizationId, userId },
        query
      );
      return res;
    },
    {
      query: CursorPaginationQuery,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_admin'],
      },
    }
  )
  .post(
    'my/add',
    async ({ body, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const result = await organizationService.addMember(
        userModule,
        organizationId,
        body
      );
      if (!result.ok) {
        if (result.code === 'USER_NOT_FOUND') {
          return status(404, { message: 'User not found' });
        }

        return status(409, { message: 'Member already exists' });
      }

      return status(200, { success: true });
    },
    {
      body: AddMemberBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_admin'],
      },
    }
  )
  .patch(
    'my/:memberId',
    async ({ params, body, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const result = await organizationService.updateMember(
        params.memberId,
        organizationId,
        body
      );
      if (!result) return status(404, { message: 'Member not found' });

      return { success: true, data: result };
    },
    {
      body: UpdateMemberBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_admin'],
      },
    }
  )
  .delete(
    'my/:memberId',
    async ({ params, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const removed = await organizationService.removeMember(
        params.memberId,
        organizationId
      );
      if (!removed) return status(404, { message: 'Member not found' });

      return { success: true };
    },
    {
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
        roles: ['shop_admin'],
      },
    }
  );
