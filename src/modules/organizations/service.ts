import { randomUUIDv7 } from 'bun';
import { and, asc, eq, gt } from 'drizzle-orm';
import { userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import type { UserContract } from '../users';
import type { AddMemberBody, CursorPaginationQuery } from './model';

export const organizationService = {
  async listMembers(
    organizations: { organizationId: string; userId: string },
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
    organizationId: string,
    memberOptions: Exclude<AddMemberBody, 'email'>
  ) {
    const userId = await userModule.getUserIdByEmail(memberOptions.email);
    if (!userId) {
      throw new Error('USER_NOT_FOUND');
    }

    if (await organizationService.isMemberExist(userId)) {
      throw new Error('MEMBER_ALREADY_EXISTS');
    }

    const { position, roles } = memberOptions;

    const add = await db.transaction(async () => {
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
    return add;
  },
  async isMemberExist(userId: string) {
    const [member] = await db
      .select({ id: userOrganizations.id })
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, userId))
      .limit(1);

    return !!member;
  },
};
