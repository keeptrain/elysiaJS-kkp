import { integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

// NOTE: sessions tidak lagi di DB — pakai SessionStore (src/lib/session-store.ts,
// saat ini in-memory, siap diganti Upstash/Redis).
export const usersTable = pgTable('users', {
  id: varchar({ length: 36 }).primaryKey(),
  email: varchar({ length: 254 }).notNull().unique(),
  createdAt: timestamp({ mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp({ mode: 'string' }).notNull().defaultNow(),
});

export const otpsTable = pgTable('otps', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: varchar({ length: 254 }).notNull(),
  code: varchar({ length: 6 }).notNull(),
  isUsed: integer().notNull().default(0),
  attempts: integer().notNull().default(0),
  expiresAt: timestamp({ mode: 'string' }).notNull(),
  createdAt: timestamp({ mode: 'string' }).notNull().defaultNow(),
});
