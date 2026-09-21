import { Elysia } from 'elysia';
import type { userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';

type MemberRow = typeof userOrganizations.$inferSelect;

export type SessionWithOrg = typeof auth.$Infer.Session & {
  organization: {
    id: MemberRow['organizationId'];
    position: MemberRow['position'];
    roles: MemberRow['roles'];
  } | null;
};

export const betterAuth = new Elysia({
  name: 'better.auth',
}).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      // Base getSession dari better-auth, tapi kita cast ke SessionWithOrg.
      const session = (await auth.api.getSession({
        headers,
      })) as unknown as SessionWithOrg | null;

      if (!session)
        return status(401, 'Unauthorized: Invalid or expired session');
      return {
        user: session.user,
        session: session.session,
        organization: session.organization,
      };
    },
  },
});
