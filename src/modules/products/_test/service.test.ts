import { beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import { auths } from '@/db/auth-schema';
import { organizations, products, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/bun-redis';
import { db } from '@/lib/pg-db';
import { organizationModule } from '@/modules/organizations';
import { getProductDetailKey, listVersionKey } from '../cache';
import { productsService } from '../service';
import { slugify } from '../utils';
import { createProductOrganization, seedProduct } from './utils';

describe('products <services test>', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await redis.incr(listVersionKey);
    await reset(db, {
      ...auths,
      organizations,
      userOrganizations,
      products,
    });
  });

  describe('success', () => {
    describe('createProduct', () => {
      it('should return correct response', async () => {
        const { organization, user } = await createProductOrganization(test);

        const result = await productsService.createProduct(organizationModule, {
          name: 'Benih Ikan Nila',
          type: 'benih',
          organizationId: organization.id,
          createdBy: user.id,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.name).toBe('Benih Ikan Nila');
        expect(result.data.type).toBe('benih');
        expect(result.data.status).toBe('draft');
        expect(result.data.slug).toBe(
          `${slugify(organization.code)}-benih-ikan-nila`
        );
        expect(result.data.sku).toBe(`${organization.code}-BENIH-IKAN-NILA`);
        expect(result.data.stockAssitance).toBe(0);
        expect(result.data.priceAssitance).toBe(0);
        expect(result.data.stockCommercial).toBe(0);
        expect(result.data.priceCommercial).toBe(0);
        expect(result.data.organizationId).toBe(organization.id);
        expect(result.data.createdBy).toBe(user.id);
      });

      it('should return correct response with body params', async () => {
        const { organization, user } = await createProductOrganization(test);

        const result = await productsService.createProduct(organizationModule, {
          name: 'Bibit Ikan Gurame',
          type: 'bibit',
          status: 'active',
          stockAssitance: 20000,
          priceAssitance: 140,
          stockCommercial: 12000,
          priceCommercial: 195,
          organizationId: organization.id,
          createdBy: user.id,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.type).toBe('bibit');
        expect(result.data.status).toBe('active');
        expect(result.data.stockAssitance).toBe(20000);
        expect(result.data.priceAssitance).toBe(140);
        expect(result.data.stockCommercial).toBe(12000);
        expect(result.data.priceCommercial).toBe(195);
      });

      it('should allow same product name in different organizations', async () => {
        const first = await createProductOrganization(test);
        const second = await createProductOrganization(test);
        const input = {
          name: 'Benih Ikan Nila',
          type: 'benih' as const,
          createdBy: first.user.id,
        };

        const firstResult = await productsService.createProduct(
          organizationModule,
          { ...input, organizationId: first.organization.id }
        );
        const secondResult = await productsService.createProduct(
          organizationModule,
          { ...input, organizationId: second.organization.id }
        );

        expect(firstResult.ok).toBe(true);
        expect(secondResult.ok).toBe(true);
      });
    });

    describe('findProductBySlug', () => {
      it('should return correct response', async () => {
        const { organization, user } = await createProductOrganization(test);
        const created = await productsService.createProduct(
          organizationModule,
          {
            name: 'Benih Ikan Nila',
            type: 'benih',
            organizationId: organization.id,
            createdBy: user.id,
          }
        );
        if (!created.ok) throw new Error('setup failed');

        const result = await productsService.findProductBySlug(
          organization.id,
          created.data.slug
        );

        expect(result?.id).toBe(created.data.id);
      });

      it('should return null when product does not exist', async () => {
        const { organization } = await createProductOrganization(test);

        const result = await productsService.findProductBySlug(
          organization.id,
          'nonexistent-slug'
        );

        expect(result).toBeNull();
      });
    });
    describe('getProductBySlug', () => {
      it('should return correct response', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await redis.del(getProductDetailKey(product.slug));

        const result = await productsService.getProductBySlug(
          organizationModule,
          product.slug
        );

        expect(result?.id).toBe(product.id);
        expect(result?.name).toBe('Benih Ikan Nila');
        expect(result?.slug).toBe(product.slug);
        expect(result?.sku).toBe(product.sku);
        expect(result?.status).toBe('active');
        expect(result?.organization).toEqual({
          id: owner.organization.id,
          name: owner.organization.name,
          code: owner.organization.code,
        });
      });

      it('should return cached result on second call', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await redis.del(getProductDetailKey(product.slug));

        const first = await productsService.getProductBySlug(
          organizationModule,
          product.slug
        );
        await db
          .update(products)
          .set({ name: 'Changed Outside Cache' })
          .where(eq(products.id, product.id));
        const second = await productsService.getProductBySlug(
          organizationModule,
          product.slug
        );

        expect(first?.name).toBe('Benih Ikan Nila');
        expect(second?.name).toBe('Benih Ikan Nila');
      });

      it('should still return product from db when redis is unavailable', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await redis.del(getProductDetailKey(product.slug));

        const getSpy = spyOn(redis, 'get').mockRejectedValue(
          new Error('redis down')
        );
        const setSpy = spyOn(redis, 'set').mockRejectedValue(
          new Error('redis down')
        );
        try {
          const result = await productsService.getProductBySlug(
            organizationModule,
            product.slug
          );

          expect(result?.id).toBe(product.id);
          expect(result?.name).toBe('Benih Ikan Nila');
        } finally {
          getSpy.mockRestore();
          setSpy.mockRestore();
        }
      });
    });
    describe('updateProduct', () => {
      it('should update product and invalidate the list cache', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(
          owner,
          'Benih Ikan Nila',
          'benih',
          'active'
        );
        await productsService.listProducts({});

        const result = await productsService.updateProduct(
          organizationModule,
          owner.organization.id,
          product.id,
          { name: 'Benih Ikan Lele', priceCommercial: 250 }
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.name).toBe('Benih Ikan Lele');
        expect(result.data.priceCommercial).toBe(250);
        expect(result.data.slug).toBe(
          `${slugify(owner.organization.code)}-benih-ikan-lele`
        );

        const list = await productsService.listProducts({});
        expect(list.items[0]?.name).toBe('Benih Ikan Lele');
      });

      it('should return PRODUCT_NOT_FOUND for another organization product', async () => {
        const owner = await createProductOrganization(test);
        const otherOwner = await createProductOrganization(test);
        const product = await seedProduct(
          otherOwner,
          'Benih Ikan Nila',
          'benih',
          'active'
        );

        const result = await productsService.updateProduct(
          organizationModule,
          owner.organization.id,
          product.id,
          { name: 'Benih Ikan Lele' }
        );

        expect(result).toEqual({ ok: false, code: 'PRODUCT_NOT_FOUND' });
      });

      it('should return PRODUCT_ALREADY_EXISTS when renaming to sibling slug', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const second = await seedProduct(owner, 'Benih Ikan Lele', 'benih');

        const result = await productsService.updateProduct(
          organizationModule,
          owner.organization.id,
          second.id,
          { name: 'Benih Ikan Nila' }
        );

        expect(result).toEqual({
          ok: false,
          code: 'PRODUCT_ALREADY_EXISTS',
        });
      });

      it('should invalidate the detail cache on update', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const oldSlug = product.slug;
        await redis.del(getProductDetailKey(oldSlug));
        await productsService.getProductBySlug(organizationModule, oldSlug);

        const result = await productsService.updateProduct(
          organizationModule,
          owner.organization.id,
          product.id,
          { name: 'Benih Ikan Lele' }
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(
          await productsService.getProductBySlug(organizationModule, oldSlug)
        ).toBeNull();

        const fresh = await productsService.getProductBySlug(
          organizationModule,
          result.data.slug
        );
        expect(fresh?.name).toBe('Benih Ikan Lele');
      });
    });
    describe('listProducts', () => {
      it('should return correct response', async () => {
        const owner = await createProductOrganization(test);
        const first = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const second = await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const result = await productsService.listProducts({});

        expect(result.items.map((product) => product.id)).toEqual([
          first.id,
          second.id,
        ]);
        expect(result.nextCursor).toBeNull();
      });

      it('should return correct response with query params', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const bibit = await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const result = await productsService.listProducts({ type: 'bibit' });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(bibit.id);
        expect(result.items[0].type).toBe('bibit');
      });

      it('should return correct response with organizationId filter', async () => {
        const firstOwner = await createProductOrganization(test);
        const secondOwner = await createProductOrganization(test);
        await seedProduct(firstOwner, 'Benih Ikan Nila', 'benih');
        const secondProduct = await seedProduct(
          secondOwner,
          'Benih Ikan Lele',
          'benih'
        );

        const result = await productsService.listProducts({
          organizationId: secondOwner.organization.id,
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(secondProduct.id);
      });

      it('should exclude non-active products', async () => {
        const owner = await createProductOrganization(test);
        const active = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Benih Ikan Lele', 'benih', 'draft');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit', 'archived');

        const result = await productsService.listProducts({});

        expect(result.items.map((product) => product.id)).toEqual([active.id]);
      });

      it('should exclude soft-deleted products', async () => {
        const owner = await createProductOrganization(test);
        const kept = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const deleted = await seedProduct(owner, 'Benih Ikan Lele', 'benih');
        await db
          .update(products)
          .set({ deletedAt: new Date() })
          .where(eq(products.id, deleted.id));

        const result = await productsService.listProducts({});

        expect(result.items.map((product) => product.id)).toEqual([kept.id]);
      });

      it('should return the next page after the cursor', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Benih Ikan Lele', 'benih');
        const third = await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const firstPage = await productsService.listProducts({ limit: 2 });
        expect(firstPage.items).toHaveLength(2);
        expect(firstPage.nextCursor).not.toBeNull();

        const secondPage = await productsService.listProducts({
          limit: 2,
          cursor: firstPage.nextCursor as string,
        });
        expect(secondPage.items.map((product) => product.id)).toEqual([
          third.id,
        ]);
        expect(secondPage.nextCursor).toBeNull();
      });

      it('should return correct response with search query', async () => {
        const owner = await createProductOrganization(test);
        const nila = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const result = await productsService.listProducts({ q: 'NILA' });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(nila.id);
      });

      it('should return empty list when search query matches nothing', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');

        const result = await productsService.listProducts({ q: 'lele' });

        expect(result).toEqual({ items: [], nextCursor: null });
      });

      it('should cache search results under separate keys', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const nila = await productsService.listProducts({ q: 'nila' });
        const gurame = await productsService.listProducts({ q: 'gurame' });

        expect(nila.items).toHaveLength(1);
        expect(nila.items[0]?.name).toBe('Benih Ikan Nila');
        expect(gurame.items).toHaveLength(1);
        expect(gurame.items[0]?.name).toBe('Bibit Ikan Gurame');
      });

      it('should return an empty list when no products exist', async () => {
        const result = await productsService.listProducts({});

        expect(result).toEqual({ items: [], nextCursor: null });
      });

      it('should still return products from db when redis is unavailable', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');

        const getSpy = spyOn(redis, 'get').mockRejectedValue(
          new Error('redis down')
        );
        const setSpy = spyOn(redis, 'set').mockRejectedValue(
          new Error('redis down')
        );
        try {
          const result = await productsService.listProducts({});

          expect(result.items).toHaveLength(1);
          expect(result.items[0]?.name).toBe('Benih Ikan Nila');
        } finally {
          getSpy.mockRestore();
          setSpy.mockRestore();
        }
      });
    });
  });

  describe('error', () => {
    describe('createProduct', () => {
      it('should return PRODUCT_ALREADY_EXISTS when product already exists', async () => {
        const { organization, user } = await createProductOrganization(test);
        const input = {
          name: 'Benih Ikan Nila',
          type: 'benih' as const,
          organizationId: organization.id,
          createdBy: user.id,
        };
        await productsService.createProduct(organizationModule, input);

        const result = await productsService.createProduct(
          organizationModule,
          input
        );

        expect(result).toEqual({
          ok: false,
          code: 'PRODUCT_ALREADY_EXISTS',
        });
      });

      it('should return ORGANIZATION_NOT_FOUND when organization does not exist', async () => {
        const { user } = await createProductOrganization(test);

        const result = await productsService.createProduct(organizationModule, {
          name: 'Benih Ikan Nila',
          type: 'benih',
          organizationId: 999999,
          createdBy: user.id,
        });

        expect(result).toEqual({
          ok: false,
          code: 'ORGANIZATION_NOT_FOUND',
        });
      });
    });

    describe('getProductBySlug', () => {
      it('should return null when product does not exist', async () => {
        await createProductOrganization(test);

        const result = await productsService.getProductBySlug(
          organizationModule,
          'nonexistent-slug'
        );

        expect(result).toBeNull();
      });

      it('should return null when product is not active', async () => {
        const owner = await createProductOrganization(test);
        const draft = await seedProduct(
          owner,
          'Benih Ikan Nila',
          'benih',
          'draft'
        );
        const archived = await seedProduct(
          owner,
          'Bibit Ikan Gurame',
          'bibit',
          'archived'
        );

        const draftResult = await productsService.getProductBySlug(
          organizationModule,
          draft.slug
        );
        const archivedResult = await productsService.getProductBySlug(
          organizationModule,
          archived.slug
        );

        expect(draftResult).toBeNull();
        expect(archivedResult).toBeNull();
      });

      it('should return null when product is soft-deleted', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await redis.del(getProductDetailKey(product.slug));
        await db
          .update(products)
          .set({ deletedAt: new Date() })
          .where(eq(products.id, product.id));

        const result = await productsService.getProductBySlug(
          organizationModule,
          product.slug
        );

        expect(result).toBeNull();
      });
    });
  });
});
