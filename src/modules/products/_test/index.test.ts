// test/index.test.ts
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { treaty } from '@elysia/eden';
import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { reset } from 'drizzle-seed';
import { auths } from '@/db/auth-schema';
import { organizations, products, userOrganizations } from '@/db/schema';
import { app } from '@/index';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/bun-redis';
import { db } from '@/lib/pg-db';
import { getProductDetailKey, listVersionKey } from '../cache';
import { slugify } from '../utils';
import {
  createProductMember,
  createProductOrganization,
  seedProduct,
} from './utils';

const api = treaty(app).api;

describe('products/index Controller', () => {
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
    describe('GET /products', () => {
      it('should return correct response', async () => {
        const owner = await createProductOrganization(test);
        const first = await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        const second = await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const response = await api.products.get();

        expect(response.status).toBe(200);
        expect(response.data?.items.map((product) => product.id)).toEqual([
          first.id,
          second.id,
        ]);
        expect(response.data?.nextCursor).toBeNull();
      });

      it('should return correct response with query params', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const response = await api.products.get({
          query: { type: 'bibit' },
        });

        expect(response.status).toBe(200);
        expect(response.data?.items).toHaveLength(1);
        expect(response.data?.items[0].type).toBe('bibit');
      });

      it('should return correct response with next cursor when limit is less than total', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih');
        await seedProduct(owner, 'Benih Ikan Lele', 'benih');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit');

        const response = await api.products.get({ query: { limit: 2 } });

        expect(response.status).toBe(200);
        expect(response.data?.items).toHaveLength(2);
        expect(response.data?.nextCursor).toBe(response.data?.items[1].id);
      });

      it('should exclude draft products', async () => {
        const owner = await createProductOrganization(test);
        await seedProduct(owner, 'Benih Ikan Nila', 'benih', 'active');
        await seedProduct(owner, 'Bibit Ikan Gurame', 'bibit', 'draft');

        const response = await api.products.get();

        expect(response.status).toBe(200);
        expect(response.data?.items).toHaveLength(1);
        expect(response.data?.items[0].status).toBe('active');
      });

      describe('VALIDATION GET /products', () => {
        it('should return 422 if type is invalid', async () => {
          const response = await api.products.get({
            query: { type: 'udang' as unknown as 'benih' },
          });
          expect(response.status).toBe(422);
        });

        it('should return 422 if cursor is not a uuid', async () => {
          const response = await api.products.get({
            query: { cursor: 'not-a-uuid' },
          });
          expect(response.status).toBe(422);
        });
      });
    });

    describe('GET /products/:slug', () => {
      it('should return product detail with organization data', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(
          owner,
          'Benih Ikan Nila',
          'benih',
          'active'
        );

        const response = await api.products({ slug: product.slug }).get();

        expect(response.status).toBe(200);
        expect(response.data?.data.id).toBe(product.id);
        expect(response.data?.data.name).toBe('Benih Ikan Nila');
        expect(response.data?.data.organization).toEqual({
          id: owner.organization.id,
          name: owner.organization.name,
          code: owner.organization.code,
        });
      });

      it('should return 404 when product slug does not exist', async () => {
        const response = await api
          .products({
            slug: 'product-not-found',
          })
          .get();

        expect(response.status).toBe(404);
        expect(response.error?.value).toEqual({
          message: 'Product not found',
        });
      });

      it('should return cached product detail', async () => {
        const owner = await createProductOrganization(test);
        const product = await seedProduct(
          owner,
          'Bibit Ikan Gurame',
          'bibit',
          'active'
        );
        await redis.del(getProductDetailKey(product.slug));

        const first = await api.products({ slug: product.slug }).get();
        await db
          .update(products)
          .set({ name: 'Changed Outside Cache' })
          .where(eq(products.id, product.id));
        const second = await api.products({ slug: product.slug }).get();

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(second.data?.data.name).toBe('Bibit Ikan Gurame');
      });
    });

    describe('POST /products', () => {
      it('should return correct response', async () => {
        const { organization, user, headers } = await createProductMember(test);

        const response = await api.products.post(
          { name: 'Benih Ikan Nila', type: 'benih' },
          { headers }
        );

        expect(response.status).toBe(201);
        const data = (response.data as { data: typeof products.$inferSelect })
          .data;
        expect(data.name).toBe('Benih Ikan Nila');
        expect(data.type).toBe('benih');
        expect(data.status).toBe('draft');
        expect(data.slug).toBe(`${slugify(organization.code)}-benih-ikan-nila`);
        expect(data.sku).toBe(`${organization.code}-BENIH-IKAN-NILA`);
        expect(data.stockAssitance).toBe(0);
        expect(data.priceAssitance).toBe(0);
        expect(data.stockCommercial).toBe(0);
        expect(data.priceCommercial).toBe(0);
        expect(data.organizationId).toBe(organization.id);
        expect(data.createdBy).toBe(user.id);
      });

      it('should return correct response with body params', async () => {
        const { headers } = await createProductMember(test);

        const response = await api.products.post(
          {
            name: 'Bibit Ikan Gurame',
            type: 'bibit',
            status: 'active',
            stockAssitance: 20000,
            priceAssitance: 140,
            stockCommercial: 12000,
            priceCommercial: 195,
          },
          { headers }
        );

        expect(response.status).toBe(201);
        const data = (response.data as { data: typeof products.$inferSelect })
          .data;
        expect(data.type).toBe('bibit');
        expect(data.status).toBe('active');
        expect(data.stockAssitance).toBe(20000);
        expect(data.priceAssitance).toBe(140);
        expect(data.stockCommercial).toBe(12000);
        expect(data.priceCommercial).toBe(195);
      });

      describe('ERROR POST /products', () => {
        it('should return 409 when product already exists', async () => {
          const { headers } = await createProductMember(test);
          await api.products.post(
            { name: 'Benih Ikan Nila', type: 'benih' },
            { headers }
          );

          const response = await api.products.post(
            { name: 'Benih Ikan Nila', type: 'benih' },
            { headers }
          );

          expect(response.status).toBe(409);
          expect(response.error?.value).toEqual({
            message: 'Product already exists',
          });
        });
      });

      describe('VALIDATION POST /products', () => {
        it('should return 422 if name is too short', async () => {
          const { headers } = await createProductMember(test);

          const response = await api.products.post(
            { name: 'ab', type: 'benih' },
            { headers }
          );
          expect(response.status).toBe(422);
        });

        it('should return 422 if type is invalid', async () => {
          const { headers } = await createProductMember(test);

          const response = await api.products.post(
            { name: 'Benih Udang', type: 'udang' as unknown as 'benih' },
            { headers }
          );
          expect(response.status).toBe(422);
        });

        it('should return 422 if stock is negative', async () => {
          const { headers } = await createProductMember(test);

          const response = await api.products.post(
            { name: 'Benih Ikan Nila', type: 'benih', stockAssitance: -1 },
            { headers }
          );
          expect(response.status).toBe(422);
        });

        it('should return 422 if required fields are missing', async () => {
          const { headers } = await createProductMember(test);

          const response = await api.products.post(
            // @ts-expect-error
            { type: 'benih' },
            { headers }
          );
          expect(response.status).toBe(422);
        });
      });

      describe('PATCH /products/my/:productId', () => {
        it('should update product and return the updated data', async () => {
          const owner = await createProductMember(test);
          const product = await seedProduct(
            owner,
            'Benih Ikan Nila',
            'benih',
            'active'
          );

          const response = await api.products
            .my({ productId: product.id })
            .patch(
              { name: 'Benih Ikan Lele', priceCommercial: 250 },
              { headers: owner.headers }
            );

          expect(response.status).toBe(200);
          expect(response.data?.data.name).toBe('Benih Ikan Lele');
          expect(response.data?.data.priceCommercial).toBe(250);
          expect(response.data?.data.slug).toBe(
            `${slugify(owner.organization.code)}-benih-ikan-lele`
          );
        });

        it('should return 404 when product does not belong to the organization', async () => {
          const member = await createProductMember(test);
          const otherOwner = await createProductOrganization(test);
          const product = await seedProduct(
            otherOwner,
            'Benih Ikan Nila',
            'benih',
            'active'
          );

          const response = await api.products
            .my({ productId: product.id })
            .patch({ name: 'Benih Ikan Lele' }, { headers: member.headers });

          expect(response.status).toBe(404);
          expect(response.error?.value).toEqual({
            message: 'Product not found',
          });
        });

        describe('VALIDATION PATCH /products/my/:productId', () => {
          it('should return 422 when body is empty without invalidating caches', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );
            const detailResponse = await api
              .products({
                slug: product.slug,
              })
              .get();
            const versionBefore = await redis.get(listVersionKey);

            const response = await api.products
              .my({ productId: product.id })
              .patch({}, { headers: owner.headers });

            expect(response.status).toBe(422);
            expect(await redis.get(listVersionKey)).toBe(versionBefore);
            expect(await redis.get(getProductDetailKey(product.slug))).toBe(
              JSON.stringify(detailResponse.data?.data)
            );
          });

          it('should return 422 if productId is not a uuid', async () => {
            const { headers } = await createProductMember(test);

            const response = await api.products
              .my({
                productId: 'not-a-uuid',
              })
              .patch({ name: 'Benih Ikan Lele' }, { headers });

            expect(response.status).toBe(422);
          });

          it('should return 422 if name is too short', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );

            const response = await api.products
              .my({ productId: product.id })
              .patch({ name: 'ab' }, { headers: owner.headers });

            expect(response.status).toBe(422);
          });

          it('should return 422 if name is too long', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );

            const response = await api.products
              .my({ productId: product.id })
              .patch({ name: 'a'.repeat(151) }, { headers: owner.headers });

            expect(response.status).toBe(422);
          });

          it('should return 422 if type is invalid', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );

            const response = await api.products
              .my({ productId: product.id })
              .patch(
                { type: 'udang' as unknown as 'benih' },
                { headers: owner.headers }
              );

            expect(response.status).toBe(422);
          });

          it('should return 422 if status is invalid', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );

            const response = await api.products
              .my({ productId: product.id })
              .patch(
                { status: 'deleted' as unknown as 'draft' },
                { headers: owner.headers }
              );

            expect(response.status).toBe(422);
          });

          it('should return 422 if stock or price is negative', async () => {
            const owner = await createProductMember(test);
            const product = await seedProduct(
              owner,
              'Benih Ikan Nila',
              'benih',
              'active'
            );

            const response1 = await api.products
              .my({ productId: product.id })
              .patch({ stockAssitance: -1 }, { headers: owner.headers });
            expect(response1.status).toBe(422);

            const response2 = await api.products
              .my({ productId: product.id })
              .patch({ priceAssitance: -10 }, { headers: owner.headers });
            expect(response2.status).toBe(422);

            const response3 = await api.products
              .my({ productId: product.id })
              .patch({ stockCommercial: -5 }, { headers: owner.headers });
            expect(response3.status).toBe(422);

            const response4 = await api.products
              .my({ productId: product.id })
              .patch({ priceCommercial: -100 }, { headers: owner.headers });
            expect(response4.status).toBe(422);
          });
        });
      });
    });
  });
});
