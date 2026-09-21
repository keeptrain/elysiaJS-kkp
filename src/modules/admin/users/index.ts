import { Elysia, status } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { userModule } from '@/modules/users';
import { actionBody, CursorPaginationQuery } from './model';
import { userService } from './service';

export const adminUsersModule = new Elysia({
  prefix: '/users',
  detail: { tags: ['users'], hide: true },
})
  .use(betterAuth)
  .use(authorizationMiddleware)
  .post(
    '',
    async ({ body, query }) => {
      switch (body.action) {
        case 'list':
          return userService.list(body.filters, query);
        case 'get': {
          const user = await userModule.getById(body.id);
          if (!user) return status(404, { message: 'User not found' });
          return user;
        }
        case 'delete':
          return userService.delete(body.id);
      }
    },
    {
      body: actionBody,
      query: CursorPaginationQuery,
      auth: true,
      authorize: { kinds: ['admin'] },
    }
  );
