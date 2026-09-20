import Elysia, { status, t, type Static } from 'elysia';
import type { SessionWithOrg } from './auth-middleware';
import {
  MAGANG_ROLES,
  MARKETPLACE_ROLES,
  ORGANIZATION_POSITIONS,
  OrganizationPosition,
  ROLES,
} from '@/constants/access-control';

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
  positions: t.Optional(
    t.Array(
      t.Union([
        t.Literal(ORGANIZATION_POSITIONS.HEAD),
        t.Literal(ORGANIZATION_POSITIONS.STAFF),
      ])
    )
  ),
  roles: t.Optional(
    t.Array(
      t.Union([
        t.Literal(ROLES.ADMIN),
        t.Literal(MARKETPLACE_ROLES.ADMIN),
        t.Literal(MARKETPLACE_ROLES.OPERATOR),
        t.Literal(MAGANG_ROLES.ADMIN),
        t.Literal(MAGANG_ROLES.OPERATOR),
      ])
    )
  ),
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
        const isAdmin = user.metadata?.kind === 'admin';
        const isOrganization = organization !== null;
        const matchesKind =
          (isAdmin && requirement.kinds.includes('admin')) ||
          (isOrganization && requirement.kinds.includes('organization'));

        if (!matchesKind) {
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
        !requirement.positions.includes(org.position as OrganizationPosition)
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
