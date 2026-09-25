import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { users } from '@/db/auth-schema';
import { db } from '@/lib/pg-db';

const seedUsers = [
  {
    name: 'C Gilang',
    email: 'cgilang02@gmail.com',
    metadata: { kind: 'admin' as const },
  },
  {
    name: 'Remaja Masjid 1945',
    email: 'remajamesjid1945@gmail.com',
    metadata: { kind: 'organization' as const },
  },
];

export async function userSeeder() {
  for (const user of seedUsers) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    if (existing) continue;

    await db.insert(users).values({
      id: randomUUIDv7(),
      ...user,
    });
  }
}
