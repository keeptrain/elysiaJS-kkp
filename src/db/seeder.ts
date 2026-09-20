import { randomUUIDv7 } from 'bun';
import * as schemas from '@/db/schema';
import { db } from '@/lib/pg-db';

export async function defaultSeeders() {
  await organizationSeeder();
}

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

  await db.insert(schemas.organizations).values({
    ...organizationsData,
  });
}
