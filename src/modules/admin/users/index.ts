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
  .get('', async ({ query }) => userService.list(query), {
    query: CursorPaginationQuery,
    auth: true,
    authorize: { kinds: ['admin'] },
  })
  .post(
    'actions',
    async ({ body }) => {
      switch (body.action) {
        case 'getById': {
          const user = await userModule.getById(body.id);
          if (!user) return status(404, { message: 'User not found' });
          return user;
        }
        case 'delete':
          return userService.delete(body.id);
      }
    },
    {
      body: actionBody, // Tidak perlu lagi nyampur CursorPaginationQuery di sini
      auth: true,
      authorize: { kinds: ['admin'] },
    }
  );
