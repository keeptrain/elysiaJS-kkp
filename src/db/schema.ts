import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from '@/db/auth-schema';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // kode UPT (misal: "UPT-PUSKESMAS-01")
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const userOrganizations = pgTable(
  'user_organizations',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    position: text('position').notNull().default('staff'),
    roles: text('roles').array().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('user_organizations_userId_idx').on(table.userId),
    index('user_organizations_organizationId_idx').on(table.organizationId),
    uniqueIndex('user_organizations_userId_organizationId_idx').on(
      table.userId,
      table.organizationId
    ),
  ]
);
