import { reset } from 'drizzle-seed';
import { env } from '@/constants/env';
import * as schemas from '@/db/schema';
import { db } from '@/lib/pg-db';
import { auths } from './auth-schema';
import {
  organizationSeeder,
  userOrganizationSeeder,
} from './seeders/organization.seed';
import { productsSeeder } from './seeders/products.seed';
import { userSeeder } from './seeders/users.seed';

const FORCE = process.argv.includes('--force');

if (!FORCE && (env.NODE_ENV === 'staging' || env.isProduction)) {
  console.error(
    `⚠️  Database seeding is blocked for ${env.NODE_ENV} environment.` +
      `\n   Use "bun run src/db/seed.ts --force" to override.`
  );
  process.exit(1);
}

export async function defaultSeeders() {
  await reset(db, { ...auths, schemas });
  await userSeeder();
  await organizationSeeder();
  await userOrganizationSeeder();
  await productsSeeder();
}

if (import.meta.main) {
  console.log(`🌱 Seeding database (${env.NODE_ENV}) ...`);
  try {
    await defaultSeeders();
    console.log('✅ Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}
