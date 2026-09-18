import { Elysia, status } from 'elysia';
import {
  MAGANG_ROLES,
  MARKETPLACE_ROLES,
  ORGANIZATION_POSITIONS,
  ROLES,
} from '@/constants/access-control';

// ── Abstraksi permission ─────────────────────────────────────────────
// TODO(PERMISSIONS): ganti isi hasPermission dengan createAccessControl +
// auth.api.hasPermission saat permission system diimplementasikan.
// Bentuk input (service + action) sengaja dibuat mirip agar migrasi drop-in.

export type PermissionService = 'shop' | 'magang';
export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

const SERVICE_ADMIN_ROLE: Record<PermissionService, string> = {
  shop: MARKETPLACE_ROLES.ADMIN,
  magang: MAGANG_ROLES.ADMIN,
};

export type Membership = {
  position: string | null;
  roles: string[];
};

export async function hasPermission(
  membership: Membership,
  service: PermissionService,
  action: PermissionAction
): Promise<boolean> {
  // Aturan sementara (belum ada permission system):
  // - global ADMIN → allow semua
  // - HEAD → allow semua di org-nya
  // - `{service}_admin` → allow semua action di service itu
  // - read → allow bila punya role apapun di service itu
  // - selain itu → deny
  const { position, roles } = membership;
  if (roles.includes(ROLES.ADMIN)) return true;
  if (position === ORGANIZATION_POSITIONS.HEAD) return true;
  if (roles.includes(SERVICE_ADMIN_ROLE[service])) return true;
  if (action === 'read' && roles.some((r) => r.startsWith(`${service}_`)))
    return true;
  return false;
}

export const requirePermission = (
  service: PermissionService,
  action: PermissionAction
) =>
  new Elysia({ name: `require-permission:${service}:${action}` }).resolve(
    { as: 'scoped' },
    async (ctx) => {
      const { position, roles } = ctx as unknown as {
        position: string | null;
        roles: string[];
      };
      if (!(await hasPermission({ position, roles }, service, action))) {
        return status(403, 'Forbidden: insufficient permission');
      }
      return {};
    }
  );
