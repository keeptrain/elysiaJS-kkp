import { Elysia, status, t } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { userService } from './service';

const actionBody = t.Union([
  t.Object({ action: t.Literal('list'), filters: t.Optional(t.Object({ search: t.Optional(t.String()) })) }),
  t.Object({ action: t.Literal('get'), id: t.String() }),
  t.Object({ action: t.Literal('create'), name: t.String(), email: t.String({ format: 'email' }) }),
  t.Object({ action: t.Literal('update'), id: t.String(), name: t.Optional(t.String()), email: t.Optional(t.String({ format: 'email' })), metadata: t.Optional(t.Object({ kind: t.Optional(t.String()) })) }),
  t.Object({ action: t.Literal('delete'), id: t.String() }),
]);

export type UsersAction = typeof actionBody.static;

export const usersApp = new Elysia({
  prefix: '/users',
  detail: { tags: ['users'], hide: true },
})
  .use(betterAuth)
  .use(authorizationMiddleware)
  .post(
    '',
    async ({ body }: { body: UsersAction }) => {
      switch (body.action) {
        case 'list':
          return userService.list(body.filters);
        case 'get': {
          const user = await userService.getById(body.id);
          if (!user) return status(404, { message: 'User not found' });
          return user;
        }
        case 'create':
          return userService.create({ name: body.name, email: body.email });
        case 'update': {
          const updated = await userService.update(body.id, {
            name: body.name,
            email: body.email,
            metadata: body.metadata,
          });
          if (!updated) return status(404, { message: 'User not found' });
          return updated;
        }
        case 'delete':
          return userService.delete(body.id);
      }
    },
    {
      body: actionBody,
      auth: true,
      authorize: { kinds: ['admin'] },
    }
  );
