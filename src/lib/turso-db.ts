import { createClient } from '@libsql/client';
import { isProduction } from '../utils/env';
import { drizzle } from 'drizzle-orm/libsql';

const libsqlUrl = process.env.TURSO_DATABASE_URL!;

// Dev: hit lokal file:database/sqllite.db (tanpa sync, cepat & offline)
// Jika butuh sync ke Turso, ganti ke embedded replica (butuh libsql sync yang stabil)
// Prod/Test: hit Turso Cloud langsung (libsql://)
export const tursoDb =
  process.env.LOCAL_DB && !isProduction
    ? createClient({
        url: process.env.LOCAL_DB, // file:database/sqllite.db
      })
    : createClient({
        url: libsqlUrl, // libsql://<db-id>.turso.io/<db-name>
        authToken: process.env.TURSO_AUTH_TOKEN!,
      });

export const db = drizzle({ client: tursoDb });
