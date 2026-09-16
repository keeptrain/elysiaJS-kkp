import { Elysia, status, t } from 'elysia';
import { sessionStore } from '../lib/session-store';

export const cookieSchema = {
  cookie: t.Object({
    session: t.String({
      minLength: 32,
      maxLength: 32,
      pattern: '^[a-zA-Z0-9]{32}$',
      error: 'Unauthorized: Invalid or expired session',
    }),
  }),
};

export const authMiddleware = new Elysia()
  .guard({
    as: 'scoped',
    cookie: cookieSchema.cookie,
  })
  .resolve({ as: 'scoped' }, async ({ cookie }) => {
    // check are session is expired
    const session = cookie.session.value 
      ? await sessionStore.get(String(cookie.session.value)) 
      : null;

    if (!session) {
      return status(401, 'Unauthorized: Invalid or expired session');
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return status(401, 'Unauthorized: Invalid or expired session');
    }

    return {
      userId: session.userId,
    };
  });
