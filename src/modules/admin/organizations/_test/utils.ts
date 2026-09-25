import type { TestHelpers } from 'better-auth/plugins';
import { organizations, userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import { createUser } from '@/modules/auth/_test/utils';

// User UPT + membership. 1 user = 1 UPT.
export async function createMemberUser(
  test: TestHelpers,
  opts: {
    email: string;
    position?: string;
    roles: string[];
  }
) {
  const user = await createUser(test, opts.email);
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'UPT Test',
      code: `UPT-${Date.now()}-${Math.random()}`,
    })
    .returning();
  await db.insert(userOrganizations).values({
    id: crypto.randomUUID(),
    userId: user.id,
    organizationId: org.id,
    position: opts.position ?? 'staff',
    roles: opts.roles,
  });
  return { user, org };
}
