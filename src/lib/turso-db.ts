import { createClient } from '@libsql/client';
import { isProduction } from '../utils/env';
import { drizzle } from 'drizzle-orm/libsql';

const libsqlUrl = process.env.TURSO_DATABASE_URL!;

// Dev: hit lokal file:database/sqllite.db (tanpa sync, cepat & offline)
// Jika butuh sync ke Turso, ganti ke embedded replica (butuh libsql sync yang stabil)
// Prod/Test: hit Turso Cloud langsung (libsql://)
export const tursoDb = createClient({
  url: isProduction ? libsqlUrl : process.env.LOCAL_DB!,
  authToken: isProduction ? process.env.TURSO_DATABASE_AUTH_TOKEN! : undefined,
});

export const db = drizzle({ client: tursoDb });
