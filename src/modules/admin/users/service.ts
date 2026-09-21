import { and, asc, eq, gt, like } from 'drizzle-orm';
import { users } from '@/db/auth-schema';
import { db } from '@/lib/pg-db';
import type { CursorPaginationQuery } from './model';

export const userService = {
  async list(query: CursorPaginationQuery) {
    const limit = query.limit ?? 10;
    const cursor = query.cursor;
    const conditions = [];
    if (query?.search) conditions.push(like(users.name, `%${query.search}%`));
    if (cursor) conditions.push(gt(users.id, cursor));
    const data = await db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(users.id))
      .limit(limit + 1);
    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, -1) : data;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;
    return { items, nextCursor };
  },
  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id));
    return { success: true };
  },
};
