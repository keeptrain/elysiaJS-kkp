import { sqliteTable, text, int } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const usersTable = sqliteTable('users', {
  id: text({ length: 36 }).primaryKey(),
  email: text({ length: 254 }).notNull().unique(),
  createdAt: text()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessionsTable = sqliteTable('sessions', {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text({ length: 36 })
    .notNull()
    .references(() => usersTable.id),
  token: text({ length: 64 }).notNull().unique(),
  expiresAt: text().notNull(),
  createdAt: text()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const otpsTable = sqliteTable('otps', {
  id: int().primaryKey({ autoIncrement: true }),
  email: text({ length: 254 }).notNull(),
  code: text({ length: 6 }).notNull(),
  isUsed: int().notNull().default(0),
  attempts: int().notNull().default(0),
  expiresAt: text().notNull(),
  createdAt: text()
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
