import Elysia, { type Static, t } from 'elysia';
import {
  MAGANG_ROLES,
  MARKETPLACE_ROLES,
  ORGANIZATION_POSITIONS,
  type OrganizationPosition,
  ROLES,
} from '@/constants/access-control';
import { auth } from '@/lib/auth';
import type { SessionWithOrg } from './auth-middleware';

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

export const authorizationMiddleware = new Elysia({
  name: 'authorization.middleware',
}).macro({
  authorize: (requirement: AuthorizationRequirement) => ({
    resolve: async ({ request, status }) => {
      const session = (await auth.api.getSession({
        headers: request.headers,
      })) as unknown as SessionWithOrg | null;

      if (!session) {
        return status(401, 'Unauthorized: Invalid or expired session');
      }

      if (requirement.kinds) {
        const hasAdmin = requirement.kinds.includes('admin');
        const hasOrg = requirement.kinds.includes('organization');

        if (hasAdmin && (requirement.positions || requirement.roles)) {
          return status(
            422,
            'Validation error: admin kind cannot have positions or roles'
          );
        }

        if (hasOrg && !hasAdmin) {
          const hasPositions = requirement.positions !== undefined;
          const hasRoles = requirement.roles !== undefined;
          if (!hasPositions || !hasRoles) {
            return status(
              422,
              'Validation error: organization kind requires both positions and roles'
            );
          }
        }

        const isAdmin = session.user.metadata?.kind === 'admin';
        const isOrganization = session.organization !== null;
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

      const org = session.organization;
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
