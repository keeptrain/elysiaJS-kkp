import Elysia, { status } from 'elysia';
import { betterAuth } from '@/middleware/auth-middleware';
import { authorizationMiddleware } from '@/middleware/authorization-middleware';
import { organizationModule } from '@/modules/organizations';
import { CreateProductBody, ListProductsQuery } from './model';
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
  );
