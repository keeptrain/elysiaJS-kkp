import Elysia, { t } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { CursorPaginationQuery } from './model';
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
  .post('abc', () => 'ok', {
    query: t.Object({
      search: t.String({ minLength: 3 }),
    }),
  });
