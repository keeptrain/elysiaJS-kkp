import Elysia, { status, t } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { organizationModule } from '@/modules/organizations';
import {
  CreateProductBody,
  ListProductsQuery,
  UpdateProductBody,
} from './model';
import { productsService } from './service';

export const productsApp = new Elysia({
  prefix: '/products',
  detail: { tags: ['products'] },
})
  .use(betterAuth)
  .use(authorizationMiddleware)
  .get('/', async ({ query }) => productsService.listProducts(query), {
    query: ListProductsQuery,
  })
  .get(
    '/:slug',
    async ({ params }) => {
      const product = await productsService.getProductBySlug(
        organizationModule,
        params.slug
      );
      if (!product) return status(404, { message: 'Product not found' });
      return { data: product };
    },
    {
      params: t.Object({
        slug: t.String({ minLength: 1, maxLength: 180 }),
      }),
    }
  )
  .post(
    '/',
    async ({ body, user, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const result = await productsService.createProduct(organizationModule, {
        ...body,
        organizationId,
        createdBy: user.id,
      });

      if (!result.ok) {
        if (result.code === 'ORGANIZATION_NOT_FOUND') {
          return status(404, { message: 'Organization not found' });
        }
        return status(409, { message: 'Product already exists' });
      }

      return status(201, { data: result.data });
    },
    {
      body: CreateProductBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head', 'staff'],
        roles: ['shop_admin', 'shop_operator'],
      },
    }
  )
  .patch(
    '/my/:productId',
    async ({ params, body, organization }) => {
      const organizationId = (organization as { id: number }).id;
      const result = await productsService.updateProduct(
        organizationModule,
        organizationId,
        params.productId,
        body
      );

      if (!result.ok) {
        if (result.code === 'PRODUCT_NOT_FOUND') {
          return status(404, { message: 'Product not found' });
        }
        if (result.code === 'ORGANIZATION_NOT_FOUND') {
          return status(404, { message: 'Organization not found' });
        }
        return status(409, { message: 'Product already exists' });
      }

      return { data: result.data };
    },
    {
      params: t.Object({
        productId: t.String({ format: 'uuid' }),
      }),
      body: UpdateProductBody,
      auth: true,
      authorize: {
        kinds: ['organization'],
        positions: ['head', 'staff'],
        roles: ['shop_admin', 'shop_operator'],
      },
    }
  );
