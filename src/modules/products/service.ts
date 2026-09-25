import { randomUUIDv7 } from 'bun';
import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { products } from '@/db/schema';
import { redis } from '@/lib/bun-redis';
import { db } from '@/lib/pg-db';
import type { OrganizationContract } from '../organizations';
import { Cache, LIST_TTL, listKey, listVersionKey } from './cache';
import type { CreateProductBody, ListProductsQuery } from './model';
import { slugify } from './utils';

export type CreateProductInput = CreateProductBody & {
  organizationId: number;
  createdBy: string;
};

export type CreateProductResult =
  | { ok: true; data: typeof products.$inferSelect }
  | { ok: false; code: 'ORGANIZATION_NOT_FOUND' | 'PRODUCT_ALREADY_EXISTS' };

export const productsService = {
  async listProducts(query: ListProductsQuery) {
    const version = (await redis.get(listVersionKey)) ?? '1';
    const cacheKey = listKey(version, query);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return Cache.buildProductsListFromCached(cached);
    }

    const limit = query.limit ?? 10;
    const conditions = [
      isNull(products.deletedAt),
      eq(products.status, 'active'),
    ];
    if (query.type) conditions.push(eq(products.type, query.type));
    if (query.organizationId) {
      conditions.push(eq(products.organizationId, query.organizationId));
    }
    if (query.cursor) conditions.push(gt(products.id, query.cursor));

    const data = await db
      .select({
        id: products.id,
        type: products.type,
        name: products.name,
        slug: products.slug,
        status: products.status,
        stockAssitance: products.stockAssitance,
        priceAssitance: products.priceAssitance,
        stockCommercial: products.stockCommercial,
        priceCommercial: products.priceCommercial,
        organizationId: products.organizationId,
      })
      .from(products)
      .where(and(...conditions))
      .limit(limit + 1)
      .orderBy(asc(products.id));

    const hasNextPage = data.length > limit;
    const items = hasNextPage ? data.slice(0, -1) : data;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    const result = { items, nextCursor };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', LIST_TTL);
    return result;
  },
  async createProduct(
    organizationModule: OrganizationContract,
    input: CreateProductInput
  ): Promise<CreateProductResult> {
    const organizationCode = await organizationModule.getCodeById(
      input.organizationId
    );
    if (!organizationCode) {
      return { ok: false, code: 'ORGANIZATION_NOT_FOUND' };
    }

    const nameSlug = slugify(input.name);
    const slug = `${slugify(organizationCode)}-${nameSlug}`;
    const sku = `${organizationCode}-${nameSlug.toUpperCase()}`;

    if (await this.findProductBySlug(input.organizationId, slug)) {
      return { ok: false, code: 'PRODUCT_ALREADY_EXISTS' };
    }

    const [product] = await db
      .insert(products)
      .values({
        id: randomUUIDv7(),
        type: input.type,
        name: input.name,
        slug,
        sku,
        status: input.status ?? 'draft',
        stockAssitance: input.stockAssitance ?? 0,
        priceAssitance: input.priceAssitance ?? 0,
        stockCommercial: input.stockCommercial ?? 0,
        priceCommercial: input.priceCommercial ?? 0,
        organizationId: input.organizationId,
        createdBy: input.createdBy,
      })
      .returning();

    if (product.status === 'active') {
      await Cache.invalidateProductsListCache();
    }

    return { ok: true, data: product };
  },
  async findProductBySlug(organizationId: number, slug: string) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          eq(products.slug, slug)
        )
      )
      .limit(1);
    return existing ?? null;
  },
};
