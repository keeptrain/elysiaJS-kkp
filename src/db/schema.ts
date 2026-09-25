import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from '@/db/auth-schema';

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
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
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: integer('organization_id')
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

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sku: text('sku').notNull(),
    status: text('status').notNull().default('draft'),
    stockAssitance: integer('stock_assitance').notNull().default(0),
    priceAssitance: numeric('price_assitance', {
      precision: 12,
      scale: 2,
      mode: 'number',
    })
      .notNull()
      .default(0),
    stockCommercial: integer('stock_commercial').notNull().default(0),
    priceCommercial: numeric('price_commercial', {
      precision: 12,
      scale: 2,
      mode: 'number',
    })
      .notNull()
      .default(0),
    organizationId: integer('organization_id')
      .notNull()
      .references(() => organizations.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    check(
      'products_id_uuid_v7_check',
      sql`substring(${table.id}::text from 15 for 1) = '7'`
    ),
    check('products_type_check', sql`${table.type} in ('benih', 'bibit')`),
    check(
      'products_status_check',
      sql`${table.status} in ('draft', 'active', 'archived')`
    ),
    check(
      'products_stock_assitance_non_negative',
      sql`${table.stockAssitance} >= 0`
    ),
    check(
      'products_price_assitance_non_negative',
      sql`${table.priceAssitance} >= 0`
    ),
    check(
      'products_stock_commercial_non_negative',
      sql`${table.stockCommercial} >= 0`
    ),
    check(
      'products_price_commercial_non_negative',
      sql`${table.priceCommercial} >= 0`
    ),
    index('idx_products_sku').on(table.sku),
    index('idx_products_slug').on(table.slug),
    index('idx_products_org').on(table.organizationId),
  ]
);
