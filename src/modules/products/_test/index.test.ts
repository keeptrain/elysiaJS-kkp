// test/index.test.ts
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { treaty } from '@elysia/eden';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { auths } from '@/db/auth-schema';
import { organizations, products, userOrganizations } from '@/db/schema';
import { app } from '@/index';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { slugify } from '../utils';
import { createProductMember } from './utils';

const api = treaty(app).api;

describe('products/index Controller', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await reset(db, {
      ...auths,
      organizations,
      userOrganizations,
      products,
    });
  });

  describe('success', () => {
    describe('GET /products', () => {});
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
    });
  });
});
