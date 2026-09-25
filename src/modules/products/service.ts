import { randomUUIDv7 } from 'bun';
import { and, eq } from 'drizzle-orm';
import { products } from '@/db/schema';
import { db } from '@/lib/pg-db';
import type { OrganizationContract } from '../organizations';
import type { CreateProductBody } from './model';
import { slugify } from './utils';

export type CreateProductInput = CreateProductBody & {
  organizationId: number;
  createdBy: string;
};

export type CreateProductResult =
  | { ok: true; data: typeof products.$inferSelect }
  | { ok: false; code: 'ORGANIZATION_NOT_FOUND' | 'PRODUCT_ALREADY_EXISTS' };

export const productsService = {
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
