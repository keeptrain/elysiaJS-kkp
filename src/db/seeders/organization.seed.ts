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

  const organizationsData = uptNames.map((name, index) => ({
    name,
    code: `UPT-${String(index + 1).padStart(2, '0')}`,
  }));

  await db.insert(schemas.organizations).values(organizationsData);
}

export async function userOrganizationSeeder() {
  await organizationService.addMember(userServices, 1, {
    email: 'remajamesjid1945@gmail.com',
    position: 'head',
  });
}
