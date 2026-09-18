import { db } from '@/lib/pg-db';
import { organizations, userOrganizations } from '@/db/schema';

export async function seedOrganizations() {
  const orgs = await db
    .insert(organizations)
    .values([
      { id: 'org-01', name: 'UPT Puskesmas 01', code: 'UPT-01' },
      { id: 'org-02', name: 'UPT Puskesmas 02', code: 'UPT-02' },
      { id: 'org-03', name: 'UPT Puskesmas 03', code: 'UPT-03' },
      { id: 'org-04', name: 'UPT Puskesmas 04', code: 'UPT-04' },
      { id: 'org-05', name: 'UPT Puskesmas 05', code: 'UPT-05' },
    ])
    .returning();

  console.log(`Seeded ${orgs.length} organizations`);
  return orgs;
}

export async function seedMembers(
  userId: string,
  organizationId: string,
  role: string
) {
  const member = await db
    .insert(userOrganizations)
    .values({ id: `${userId}-${organizationId}`, userId, organizationId, role })
    .returning();
  return member[0];
}
