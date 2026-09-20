import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { seed } from 'drizzle-seed';
import { organizations, userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import { createUser } from '@/modules/auth/_test/utils';

export async function createOrganization(name = 'Test Organization') {
  await seed(db, { organizations }, { count: 1 }).refine((funcs) => ({
    organizations: {
      columns: {
        name: funcs.valuesFromArray({ values: [name] }),
        code: funcs.valuesFromArray({
          values: [`ORG-${randomUUIDv7()}`],
          isUnique: true,
        }),
      },
    },
  }));

  const [organization] = await db.select().from(organizations);
  return organization;
}

export async function createMembers(test: TestHelpers, count: number) {
  const organization = await createOrganization();
  const organizationId = organization.id;

  const members = [];
  for (let index = 0; index < count; index++) {
    const user = await createUser(test);
    const [member] = await db
      .insert(userOrganizations)
      .values({
        id: randomUUIDv7(),
        userId: user.id,
        organizationId,
        position: index === 0 ? 'head' : 'staff',
        roles: index === 0 ? ['shop_admin'] : ['shop_operator'],
      })
      .returning();
    members.push({ user, member });
  }

  return { organizationId, members };
}
