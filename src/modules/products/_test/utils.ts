import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { organizations, userOrganizations } from '@/db/schema';
import { db } from '@/lib/pg-db';
import { createUser } from '@/modules/auth/_test/utils';
import { organizationModule } from '@/modules/organizations';
import { productsService } from '../service';

export type ProductOwner = Awaited<
  ReturnType<typeof createProductOrganization>
>;

export async function seedProduct(
  owner: ProductOwner,
  name: string,
  type: 'benih' | 'bibit',
  status: 'draft' | 'active' | 'archived' = 'active'
) {
  const result = await productsService.createProduct(organizationModule, {
    name,
    type,
    status,
    organizationId: owner.organization.id,
    createdBy: owner.user.id,
  });
  if (!result.ok) throw new Error('seed product failed');
  return result.data;
}

export async function createProductOrganization(test: TestHelpers) {
  const [organization] = await db
    .insert(organizations)
    .values({ name: 'Product Organization', code: `ORG-${randomUUIDv7()}` })
    .returning();

  const user = await createUser(test);
  return { organization, user };
}

export async function createProductMember(test: TestHelpers) {
  const { organization, user } = await createProductOrganization(test);
  await db.insert(userOrganizations).values({
    id: randomUUIDv7(),
    userId: user.id,
    organizationId: organization.id,
    position: 'head',
    roles: ['shop_admin'],
  });

  const { headers } = await test.login({ userId: user.id });
  return { organization, user, headers };
}
