import { Elysia, status, t } from 'elysia';

export const cookieSchema = {
  cookie: t.Object({
    session: t.String({
      minLength: 16,
      maxLength: 16,
      error: 'Invalid session cookie',
    }),
  }),
};

export const authMiddleware = new Elysia()
  .guard({
    as: 'scoped',
    cookie: cookieSchema.cookie,
  })
  .resolve({ as: 'scoped' }, ({ cookie: { session } }) => {
    // check cookie session in redis or database
    const a16 = 'a'.repeat(16);
    if (session.value !== a16) {
      return status(401, { message: 'Unauthorized' });
    }

    return {
      userId: a16,
    };
  });
