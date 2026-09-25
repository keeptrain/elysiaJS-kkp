import * as schemas from '@/db/schema';
import { db } from '@/lib/pg-db';
import { generateOrganizationCode } from '@/modules/admin/organizations/utils';
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

  const organizationsData = uptNames.map((name) => ({
    name,
    code: generateOrganizationCode(name),
  }));

  await db.insert(schemas.organizations).values(organizationsData);
}

export async function userOrganizationSeeder() {
  const [firstOrganization] = await db
    .select({ id: schemas.organizations.id })
    .from(schemas.organizations)
    .orderBy(schemas.organizations.id)
    .limit(1);

  await organizationService.addMember(userServices, firstOrganization.id, {
    email: 'remajamesjid1945@gmail.com',
    position: 'head',
  });
}
