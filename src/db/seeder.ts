import { reset } from 'drizzle-seed';
import { env } from '@/constants/env';
import * as schemas from '@/db/schema';
import { db } from '@/lib/pg-db';
import {
  organizationSeeder,
  userOrganizationSeeder,
} from './seeders/organization.seed';

const FORCE = process.argv.includes('--force');

if (!FORCE && (env.NODE_ENV === 'staging' || env.isProduction)) {
  console.error(
    `⚠️  Database seeding is blocked for ${env.NODE_ENV} environment.` +
      `\n   Use "bun run src/db/seed.ts --force" to override.`
  );
  process.exit(1);
}

export async function defaultSeeders() {
  await reset(db, schemas);
  await organizationSeeder();
  await userOrganizationSeeder();
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
