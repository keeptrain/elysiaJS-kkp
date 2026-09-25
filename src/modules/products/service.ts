import { randomUUIDv7 } from 'bun';
import { and, asc, eq, gt, isNull, ne } from 'drizzle-orm';
import { products } from '@/db/schema';
import { redis } from '@/lib/bun-redis';
import { db } from '@/lib/pg-db';
import type { OrganizationContract } from '../organizations';
import * as ProductCache from './cache';
import type {
  CreateProductBody,
  ListProductsQuery,
  UpdateProductBody,
} from './model';
import { slugify } from './utils';

export type CreateProductInput = CreateProductBody & {
  organizationId: number;
  createdBy: string;
};

export type CreateProductResult =
  | { ok: true; data: typeof products.$inferSelect }
  | { ok: false; code: 'ORGANIZATION_NOT_FOUND' | 'PRODUCT_ALREADY_EXISTS' };

export type UpdateProductResult =
  | { ok: true; data: typeof products.$inferSelect }
  | {
      ok: false;
      code:
        | 'PRODUCT_NOT_FOUND'
        | 'ORGANIZATION_NOT_FOUND'
        | 'PRODUCT_ALREADY_EXISTS';
    };

export const productsService = {
  async listProducts(query: ListProductsQuery) {
    const version = (await redis.get(ProductCache.listVersionKey)) ?? '1';
    const cacheKey = ProductCache.getProductListKey(version, query);
    const cached = await redis.get(cacheKey);
    if (cached) {
      return ProductCache.buildProductListFromCached(cached);
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
    await redis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      ProductCache.LIST_TTL
    );
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
      await ProductCache.invalidateProductListCache();
    }

    return { ok: true, data: product };
  },
  async updateProduct(
    organizationModule: OrganizationContract,
    organizationId: number,
    productId: string,
    input: UpdateProductBody
  ): Promise<UpdateProductResult> {
    const current = await this.getProductById(productId, organizationId);
    if (!current) return { ok: false, code: 'PRODUCT_NOT_FOUND' };

    const patch: Partial<typeof products.$inferInsert> = { ...input };
    if (input.name !== undefined) {
      const organizationCode =
        await organizationModule.getCodeById(organizationId);
      if (!organizationCode) {
        return { ok: false, code: 'ORGANIZATION_NOT_FOUND' };
      }

      const nameSlug = slugify(input.name);
      patch.slug = `${slugify(organizationCode)}-${nameSlug}`;
      patch.sku = `${organizationCode}-${nameSlug.toUpperCase()}`;

      if (await this.findProductBySlug(organizationId, patch.slug, productId)) {
        return { ok: false, code: 'PRODUCT_ALREADY_EXISTS' };
      }
    }

    const [product] = await db
      .update(products)
      .set(patch)
      .where(eq(products.id, productId))
      .returning();

    if (!product) return { ok: false, code: 'PRODUCT_NOT_FOUND' };
    await ProductCache.invalidateProductListCache();
    return { ok: true, data: product };
  },
  async getProductById(id: string, organizationId?: number) {
    const conditions = [eq(products.id, id), isNull(products.deletedAt)];

    // Used for organization context,
    // to ensure the product belongs to the organization
    if (organizationId !== undefined) {
      conditions.push(eq(products.organizationId, organizationId));
    }

    const [product] = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(1);
    return product ?? null;
  },
  async findProductBySlug(
    organizationId: number,
    slug: string,
    excludeProductId?: string
  ) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          eq(products.slug, slug),
          ...(excludeProductId ? [ne(products.id, excludeProductId)] : [])
        )
      )
      .limit(1);
    return existing ?? null;
  },
};
