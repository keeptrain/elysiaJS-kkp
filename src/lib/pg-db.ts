import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/constants/env';

/**
 * Using postgres as main database
 */
const client = postgres(env.DATABASE_URL);

export const db = drizzle({ client });
