import { Elysia, status, t, type Static } from 'elysia';
import { auth } from '@/lib/auth';
import type { userOrganizations } from '@/db/schema';
import {
  MARKETPLACE_ROLES,
  MAGANG_ROLES,
  ORGANIZATION_POSITIONS,
  ROLES,
} from '@/constants/access-control';

type MemberRow = typeof userOrganizations.$inferSelect;

type SessionWithOrg = typeof auth.$Infer.Session & {
  organization: {
    id: MemberRow['organizationId'];
    position: MemberRow['position'];
    roles: MemberRow['roles'];
  } | null;
};

const getSessionWithOrg = async (headers: Headers) =>
  (await auth.api.getSession({ headers })) as unknown as SessionWithOrg | null;

export const authMiddleware = new Elysia({
  name: 'auth-middleware',
}).resolve({ as: 'scoped' }, async ({ request }) => {
  const session = await getSessionWithOrg(request.headers);

  if (session === null) {
    return status(401, 'Unauthorized: Invalid or expired session');
  }

  return {
    user: session.user,
    session,
  };
});

const kindRequirementSchema = t.Object({
  kinds: t.Array(t.Union([t.Literal('admin'), t.Literal('organization')])),
});

export type KindRequirement = Static<typeof kindRequirementSchema>;

const chainedSession = {
  decorator: {},
  store: {},
  derive: {},
  resolve: { session: {} as SessionWithOrg },
} as const;

export const kindMiddleware = new Elysia<'', typeof chainedSession>({
  name: 'kind-middleware',
}).macro({
  // Pemakaian route: `{ kind: { kinds: ['admin'] } }`
  kind: (requirement: KindRequirement) => ({
    resolve: ({ session }) => {
      if (!session) {
        return status(401, 'Unauthorized: Invalid or expired session');
      }
      const kind =
        session.user.metadata?.kind === 'admin' ? 'admin' : 'organization';
      if (!requirement.kinds.includes(kind)) {
        return status(
          403,
          `Forbidden: requires kind ${requirement.kinds.join('/')}`
        );
      }
      return {};
    },
  }),
});

const orgRequirementSchema = t.Object({
  positions: t.Optional(
    t.Array(
      t.Union(Object.values(ORGANIZATION_POSITIONS).map((p) => t.Literal(p)))
    )
  ),
  roles: t.Optional(
    t.Array(
      t.Union([
        ...Object.values(ROLES).map((r) => t.Literal(r)),
        ...Object.values(MARKETPLACE_ROLES).map((r) => t.Literal(r)),
        ...Object.values(MAGANG_ROLES).map((r) => t.Literal(r)),
      ])
    )
  ),
});

export type OrgRequirement = Static<typeof orgRequirementSchema>;

export const organizationMiddleware = new Elysia<'', typeof chainedSession>({
  name: 'organization-middleware',
}).macro({
  // Macro fungsi: nilai di route `{ org: {...} }` masuk sebagai argumen.
  // `seed` hanya checksum dedup, bukan passing data.
  org: (requirement: OrgRequirement) => ({
    resolve: ({ session }) => {
      // Wajib chained setelah authMiddleware (tanpa itu tidak ada session).
      if (!session) {
        return status(401, 'Unauthorized: Invalid or expired session');
      }
      const org = session.organization;
      if (!org) {
        return status(403, 'Forbidden: no organization membership');
      }
      if (
        requirement.positions &&
        !requirement.positions.includes(org.position as 'head' | 'staff')
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

      // Lolos: tidak return apa-apa, handler baca session langsung.
      return {};
    },
  }),
});
