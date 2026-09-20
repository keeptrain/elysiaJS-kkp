import Elysia from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { getMySqlColumnBuilders } from 'drizzle-orm/mysql-core/columns/all';
import { CursorPaginationQuery } from './model';
import { organizationService } from './service';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';

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
  );
