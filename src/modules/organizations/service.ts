import { randomUUIDv7 } from 'bun';
import { and, asc, eq, gt } from 'drizzle-orm';
import { organizations, userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import { invalidateMemberCache } from '@/modules/organizations/membership';
import type { UserContract } from '../users';
import type {
  AddMemberBody,
  CursorPaginationQuery,
  UpdateMemberBody,
} from './model';

export type AddMemberResult =
  | { ok: true }
  | {
      ok: false;
      code: 'USER_NOT_FOUND' | 'MEMBER_ALREADY_EXISTS';
    };

export const organizationService = {
  async getCodeById(id: number) {
    const [organization] = await db
      .select({ code: organizations.code })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return organization?.code ?? null;
  },
  async listMembers(
    organizations: { organizationId: number; userId: string },
    query: CursorPaginationQuery
  ) {
    const { organizationId: org } = organizations;
    const limit = query.limit ?? 10;
    const cursor = query.cursor;

    const conditions = [eq(userOrganizations.organizationId, org)];
    if (cursor) {
      conditions.push(gt(userOrganizations.id, cursor));
    }

    const data = await db
      .select()
      .from(userOrganizations)
      .where(and(...conditions))
      .limit(limit + 1)
      .orderBy(asc(userOrganizations.id));

    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, -1) : data;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
    };
  },
  async detailMember(userId: string) {
    const [member] = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, userId))
      .limit(1);
    return member ?? null;
  },
  async addMember(
    userModule: UserContract,
    organizationId: number,
    memberOptions: AddMemberBody
  ): Promise<AddMemberResult> {
    const userId = await userModule.getUserIdByEmail(memberOptions.email);
    if (!userId) {
      return { ok: false, code: 'USER_NOT_FOUND' };
    }

    if (await organizationService.isMemberExist(userId)) {
      return { ok: false, code: 'MEMBER_ALREADY_EXISTS' };
    }

    const { position, roles } = memberOptions;

    await db.transaction(async () => {
      await db.insert(userOrganizations).values({
        id: randomUUIDv7(),
        organizationId,
        userId,
        position,
        roles,
      });

      await userModule.updateUser(userId, {
        metadata: {
          kind: 'organization',
        },
      });
    });
    return { ok: true };
  },
  async isMemberExist(userId: string) {
    const [member] = await db
      .select({ id: userOrganizations.id })
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, userId))
      .limit(1);
    return !!member;
  },
  async updateMember(
    userId: string,
    organizationId: number,
    data: UpdateMemberBody
  ) {
    const { position, roles } = data;

    const [updated] = await db
      .update(userOrganizations)
      .set({
        ...(position ? { position } : {}),
        ...(roles ? { roles } : {}),
      })
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning();

    if (updated) await invalidateMemberCache(userId);
    return updated ?? null;
  },
  async removeMember(userId: string, organizationId: number) {
    const [removed] = await db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning({ id: userOrganizations.id });

    if (!removed) return false;

    await invalidateMemberCache(userId);
    return true;
  },
};
