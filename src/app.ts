import { Elysia } from 'elysia';
import { corsPlugin, openapiPlugin } from '@/lib/elysia-plugins';
import {} from '@/middleware/auth-middleware';
import { ipRateLimiterMiddleware } from '@/middleware/public-middleware';
import { organizationsApp } from '@/modules/admin/organizations';
import { adminUsersModule } from '@/modules/admin/users';
import { productsApp } from '@/modules/products';
import { auth } from './lib/auth';
import { organizationRoutes } from './modules/organizations';
import { userServices } from './modules/users/service';

const publicRoutes = new Elysia().use(productsApp);

const protectedRoutes = new Elysia()
  .decorate('userService', userServices)
  .use(organizationsApp)
  .use(adminUsersModule)
  .use(organizationRoutes);

export const app = new Elysia({ prefix: '/api' })
  .onError(({ code, set }) => {
    if (code === 'VALIDATION') {
      set.status = 422;
      return { message: 'Invalid request' };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { message: 'Route not found' };
    }

    set.status = 500;
    return { message: 'Internal server error' };
  })
  .use(corsPlugin)
  // .use(ipRateLimiterMiddleware)
  .use(openapiPlugin)
  .mount(auth.handler)
  .use(publicRoutes)
  .use(protectedRoutes);

export type App = typeof app;
