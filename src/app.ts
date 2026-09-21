import { Elysia } from 'elysia';
import { corsPlugin, openapiPlugin } from '@/lib/elysia-plugins';
import {} from '@/middleware/auth-middleware';
import { ipRateLimiterMiddleware } from '@/middleware/public-middleware';
import { organizationsApp } from '@/modules/admin/organizations';
import { adminUsersModule } from '@/modules/admin/users';
import { productsApp } from '@/modules/products';

import { authRoutes } from './modules/auth';
import { organizationRoutes } from './modules/organizations';
import { userServices } from './modules/users/service';

const publicRoutes = new Elysia().use(productsApp);

const protectedRoutes = new Elysia()
  .decorate('userService', userServices)
  .use(organizationsApp)
  .use(adminUsersModule)
  .use(organizationRoutes);

export const app = new Elysia({ prefix: '/api' })
  .use(corsPlugin)
  // .use(ipRateLimiterMiddleware)
  .use(openapiPlugin)
  .use(authRoutes)
  .use(publicRoutes)
  .use(protectedRoutes);

export type App = typeof app;
