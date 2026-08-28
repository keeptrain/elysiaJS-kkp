import { createClient } from '@libsql/client';

const libsqlUrl = process.env.TURSO_DATABASE_URL!.replace(
  /^turso:\/\//,
  'libsql://'
);

// Dev: hit lokal file:database/sqllite.db (tanpa sync, cepat & offline)
// Jika butuh sync ke Turso, ganti ke embedded replica (butuh libsql sync yang stabil)
// Prod/Test: hit Turso Cloud langsung (libsql://)
export const tursoDb =
  process.env.LOCAL_DB && process.env.NODE_ENV !== 'production'
    ? createClient({
        url: process.env.LOCAL_DB, // file:database/sqllite.db
      })
    : createClient({
        url: libsqlUrl,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      });
