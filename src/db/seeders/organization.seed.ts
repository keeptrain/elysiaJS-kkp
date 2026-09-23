import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import * as schemas from '@/db/schema';
import { db } from '@/lib/pg-db';
import { organizationService } from '@/modules/organizations/service';
import { userServices } from '@/modules/users/service';

export async function organizationSeeder() {
  const uptNames = [
    'Balai Perikanan Budidaya Air Tawar Sungai Gelam',
    'Balai Perikanan Budidaya Air Tawar Mandiangin',
    'Balai Perikanan Budidaya Air Tawar Tatelu',
    'Balai Perikanan Budidaya Air Payau Situbondo',
    'Balai Perikanan Budidaya Air Payau Takalar',
    'Balai Perikanan Budidaya Air Payau Ujung Batee',
    'Balai Perikanan Budidaya Laut Batam',
    'Balai Perikanan Budidaya Laut Lombok',
    'Balai Perikanan Budidaya Laut Ambon',
    'Balai Layanan Usaha Produksi Perikanan Budidaya, Karawang',
    'Balai Produksi Induk Udang Unggul Dan Kekerangan Karangasem, Bali',
    'Balai Pengujian Kesehatan Ikan Dan Lingkungan, Serang',
    'Balai Besar Perikanan Budidaya Air Tawar Sukabumi',
    'Balai Besar Perikanan Budidaya Air Payau Jepara',
    'Balai Besar Perikanan Budidaya Laut Lampung',
  ];

  const organizationsData = uptNames.map((name) => {
    const id = randomUUIDv7();
    return {
      id: id,
      name: name,
      code: `UPT-${id}`,
    };
  });

  await db.insert(schemas.organizations).values(organizationsData);
}

export async function userOrganizationSeeder() {
  const [organizationId] = await db
    .select({ id: schemas.organizations.id })
    .from(schemas.organizations)
    .where(
      eq(
        schemas.organizations.name,
        'Balai Besar Perikanan Budidaya Air Tawar Sukabumi'
      )
    )
    .limit(1);

  await organizationService.addMember(userServices, organizationId.id, {
    email: 'remajamesjid1945@gmail.com',
    position: 'head',
  });
}
