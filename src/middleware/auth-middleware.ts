import { Elysia, status } from 'elysia';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { userOrganizations } from '@/db/schema';

export const authMiddleware = new Elysia({
  name: 'auth-middleware',
}).resolve({ as: 'scoped' }, async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });

  if (session === null) {
    return status(401, 'Unauthorized: Invalid or expired session');
  }

  return {
    user: session.user,
  };
});

export const organizationMiddleware = () =>
  new Elysia({
    name: 'organization-middleware',
  }).resolve({ as: 'scoped' }, async ({ request }) => {});
