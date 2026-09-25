import { randomUUIDv7 } from 'bun';
import { and, desc, eq, like, sql } from 'drizzle-orm';
import type { AppRole, OrganizationPosition } from '@/constants/access-control';
import { organizations, userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import {
  findMemberByUserId,
  invalidateMemberCache,
} from '@/modules/organizations/membership';
import { generateOrganizationCode } from './utils';

const ORGANIZATION_CODE_LOCK = sql`pg_advisory_xact_lock(hashtext('organizations:code'))`;

export const organizationService = {
  async list(filters?: { search?: string }) {
    const base = db.select().from(organizations);
    if (filters?.search) {
      return base
        .where(like(organizations.name, `%${filters.search}%`))
        .orderBy(desc(organizations.createdAt));
    }
    return base.orderBy(desc(organizations.createdAt));
  },

  async getById(id: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return org ?? null;
  },

  async create(data: { name: string; code?: string }) {
    const code = data.code ?? generateOrganizationCode(data.name);

    return db.transaction(async (tx) => {
      await tx.execute(sql`select ${ORGANIZATION_CODE_LOCK}`);
      const [org] = await tx
        .insert(organizations)
        .values({ id: randomUUIDv7(), name: data.name, code })
        .returning();
      return org;
    });
  },

  async update(id: string, data: { name?: string; code?: string }) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select ${ORGANIZATION_CODE_LOCK}`);
      const [current] = await tx
        .select({ name: organizations.name, code: organizations.code })
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      if (!current) return null;

      const patch = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined
          ? { code: data.code }
          : data.name !== undefined
            ? { code: generateOrganizationCode(data.name) }
            : {}),
      };
      const [org] = await tx
        .update(organizations)
        .set(patch)
        .where(eq(organizations.id, id))
        .returning();
      return org ?? null;
    });
  },

  async delete(id: string) {
    await db.delete(organizations).where(eq(organizations.id, id));
    return { success: true };
  },

  // ── Member management ──────────────────────────────────────────────────
  async listMembers(organizationId: string) {
    return db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));
  },

  async addMember(data: {
    userId: string;
    organizationId: string;
    position?: OrganizationPosition;
    roles: AppRole[];
  }) {
    const [member] = await db
      .insert(userOrganizations)
      .values({ id: randomUUIDv7(), ...data })
      .returning();
    await invalidateMemberCache(data.userId);
    return member;
  },

  // Read didelegasikan ke modul umum (single source + cache).
  findMemberByUserId,

  async updateMemberRole(
    userId: string,
    organizationId: string,
    roles: AppRole[]
  ) {
    const [member] = await db
      .update(userOrganizations)
      .set({ roles })
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning();
    await invalidateMemberCache(userId);
    return member ?? null;
  },

  async removeMember(userId: string, organizationId: string) {
    await db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      );
    await invalidateMemberCache(userId);
    return { success: true };
  },
};
