import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { redis } from '@/lib/bun-redis';
import { userOrganizations } from '@/db/schema';

// Read-side membership + cache, dipakai semua consumer (hook auth,
// middleware, route user). Admin writes invalidate lewat sini agar
// arah dependensi tetap: admin → umum, tidak sebaliknya.
//
// Cache-aside, TTL 300 dtk. Null tidak di-cache: user tanpa membership
// tetap 1 query indexed murah, tanpa risiko basi saat assign.
const MEMBER_TTL = 300;
const memberKey = (userId: string) => `member:${userId}`;

export async function invalidateMemberCache(
  userId: string
): Promise<void> {
  await redis.del(memberKey(userId));
}

export async function findMemberByUserId(userId: string) {
  const cached = await redis.get(memberKey(userId));
  if (cached)
    return JSON.parse(cached) as typeof userOrganizations.$inferSelect;
  const [member] = await db
    .select()
    .from(userOrganizations)
    .where(eq(userOrganizations.userId, userId))
    .limit(1);
  if (member)
    await redis.set(
      memberKey(userId),
      JSON.stringify(member),
      'EX',
      MEMBER_TTL
    );
  return member ?? null;
}
