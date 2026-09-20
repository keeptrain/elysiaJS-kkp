import { Elysia } from 'elysia';
import { corsPlugin, openapiPlugin } from '@/lib/elysia-plugins';
import { productsApp } from '@/modules/products';
import { organizationsApp } from '@/modules/admin/organizations';
import { ipRateLimiterMiddleware } from '@/middleware/public-middleware';
import {} from '@/middleware/auth-middleware';
import { authRoutes } from './modules/auth';
import { organizationRoutes } from './modules/organizations';

const publicRoutes = new Elysia().use(productsApp);

const protectedRoutes = new Elysia()
  .use(organizationsApp)
  .use(organizationRoutes);

export const app = new Elysia({ prefix: '/api' })
  .use(corsPlugin)
  // .use(ipRateLimiterMiddleware)
  .use(openapiPlugin)
  .use(authRoutes)
  .use(publicRoutes)
  .use(protectedRoutes);

export type App = typeof app;
