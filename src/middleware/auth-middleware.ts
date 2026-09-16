import { Elysia, status } from 'elysia';
import { auth } from '../lib/auth';

export const authMiddleware = new Elysia({
  name: 'auth-middleware',
}).resolve({ as: 'scoped' }, async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return status(401, 'Unauthorized: Invalid or expired session');
  }

  return {
    userId: session.user.id,
    user: session.user,
    session: session.session,
  };
});
