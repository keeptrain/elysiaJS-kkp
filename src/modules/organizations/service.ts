import { userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import type { CursorPaginationQuery } from './model';
import { and, asc, eq, gt } from 'drizzle-orm';

export const organizationService = {
  async listMembers(
    organizations: { organizationId: string; userId: string },
    query: CursorPaginationQuery
  ) {
    const { organizationId: org } = organizations;
    const limit = query.limit ?? 10;
    const cursor = query.cursor;

    // Gabungkan kondisi where: filter berdasarkan UPT DAN kursor (jika ada)
    const conditions = [eq(userOrganizations.organizationId, org)];
    if (cursor) {
      conditions.push(gt(userOrganizations.id, cursor));
    }

    const data = await db
      .select()
      .from(userOrganizations)
      .where(and(...conditions))
      .limit(limit + 1) // Ambil lebih 1 untuk cek next page
      .orderBy(asc(userOrganizations.id)); // Wajib di-order agar kursor konsisten

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
};
