import Elysia from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { userModule } from '../users';
import {
  AddMemberBody,
  CursorPaginationQuery,
  UpdateMemberBody,
} from './model';
import { organizationService } from './service';

export const organizationRoutes = new Elysia({
  prefix: '/organizations',
  detail: { tags: ['organizations'], hide: true },
})
  .use(betterAuth)
  .use(authorizationMiddleware)
  .get(
    'my',
    async ({ query, user: { id: userId }, organization }) => {
      const organizationId = (organization as { id: string }).id;
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
      },
    }
  )
  .post(
    'my/add',
    async ({ body, organization }) => {
      const organizationId = (organization as { id: string }).id;
      await organizationService.addMember(userModule, organizationId, body);
    },
    {
      body: AddMemberBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
      },
    }
  )
  .patch(
    'my/:memberId',
    async ({ params, body, organization }) => {
      const organizationId = (organization as { id: string }).id;
      const result = await organizationService.updateMember(
        params.memberId,
        organizationId,
        body
      );
      return result
        ? { success: true, data: result }
        : { success: false, message: 'Member not found' };
    },
    {
      body: UpdateMemberBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
      },
    }
  )
  .delete(
    'my/:memberId',
    async ({ params, organization }) => {
      const organizationId = (organization as { id: string }).id;
      await organizationService.removeMember(params.memberId, organizationId);
      return { success: true };
    },
    {
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head'],
      },
    }
  );
