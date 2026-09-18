import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { db } from '@/lib/pg-db';
import { organizations, userOrganizations } from '@/db/schema';
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
      id: randomUUIDv7(),
      name: 'UPT Test',
      code: `UPT-${Date.now()}-${Math.random()}`,
    })
    .returning();
  await db.insert(userOrganizations).values({
    id: randomUUIDv7(),
    userId: user.id,
    organizationId: org.id,
    position: opts.position ?? 'staff',
    roles: opts.roles,
  });
  return { user, org };
}

export async function cleanOrgDb(): Promise<void> {
  await db.delete(userOrganizations);
  await db.delete(organizations);
}
