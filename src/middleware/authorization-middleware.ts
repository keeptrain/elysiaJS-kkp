import Elysia, { status, t, type Static } from 'elysia';
import type { SessionWithOrg } from './auth-middleware';
const chainedSession = {
  decorator: {},
  store: {},
  derive: {},
  resolve: {
    session: {} as SessionWithOrg['session'],
    user: {} as SessionWithOrg['user'],
    organization: {} as SessionWithOrg['organization'],
  },
} as const;

const orgRequirementSchema = t.Object({
  kinds: t.Optional(
    t.Array(t.Union([t.Literal('admin'), t.Literal('organization')]))
  ),
  positions: t.Optional(t.Array(t.String())),
  roles: t.Optional(t.Array(t.String())),
});

export type AuthorizationRequirement = Static<typeof orgRequirementSchema>;

export const authorizationMiddleware = new Elysia<'', typeof chainedSession>({
  name: 'authorization-middleware',
}).macro({
  authorize: (requirement: AuthorizationRequirement) => ({
    resolve: ({ session, user, organization }) => {
      if (!session) {
        return status(401, 'Unauthorized: Invalid or expired session');
      }

      if (requirement.kinds) {
        const kind = user.metadata?.kind;
        if (!kind || !requirement.kinds.includes(kind)) {
          return status(
            403,
            `Forbidden: requires kind ${requirement.kinds.join('/')}`
          );
        }
      }

      const requiresOrganization =
        requirement.positions !== undefined || requirement.roles !== undefined;
      if (!requiresOrganization) return {};

      const org = organization;
      if (!org) return status(403, 'Forbidden: no organization membership');

      if (
        requirement.positions &&
        !requirement.positions.includes(org.position)
      ) {
        return status(
          403,
          `Forbidden: requires position ${requirement.positions.join('/')}`
        );
      }

      if (
        requirement.roles &&
        !requirement.roles.some((r) => org.roles.includes(r))
      ) {
        return status(403, 'Forbidden: insufficient roles');
      }

      return {};
    },
  }),
});
