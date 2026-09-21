import { desc, eq, like } from 'drizzle-orm';
import { users } from '@/db/auth-schema';
import { db } from '@/lib/pg-db';
import { userModule } from '@/modules/users';

export const userService = {
  async list(filters?: { search?: string }) {
    const base = db.select().from(users);
    if (filters?.search) {
      return base.where(like(users.name, `%${filters.search}%`)).orderBy(desc(users.createdAt));
    }
    return base.orderBy(desc(users.createdAt));
  },
  async getById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  },
  async create(data: { name: string; email: string; metadata?: { kind?: string } }) {
    const [user] = await db.insert(users).values({ ...data, emailVerified: false }).returning();
    return user;
  },
  async update(id: string, data: Partial<{ name: string; email: string; metadata: { kind?: string } }>) {
    const [updated] = await userModule.updateUser(id, data);
    return updated ?? null;
  },
  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id));
    return { success: true };
  },
};
