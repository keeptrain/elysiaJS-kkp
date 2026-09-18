import { env } from '@/constants/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Dev (app di host): DATABASE_URL menunjuk localhost:5433 (lihat .env.development).
// Staging/prod (app di container): DATABASE_URL menunjuk host `db:5432`.
const client = postgres(env.DATABASE_URL);

export const db = drizzle({ client });
