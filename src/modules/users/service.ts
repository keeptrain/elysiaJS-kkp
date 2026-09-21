import { eq } from 'drizzle-orm';
import { UserSchema, users } from '@/db/auth-schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';

export const userServices = {
  async getUserIdByEmail(email: string) {
    return await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((rows) => (rows.length > 0 ? rows[0].id : null));
  },
  async updateUser(userId: string, data: Partial<UserSchema> = {}) {
    const update = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return update;
  },
};
