import { Elysia } from 'elysia';

import { env } from '@/constants/env';
import { betterAuthRouteHook, betterAuthView } from '@/modules/auth/utils';
import { corsPlugin, openapiPlugin } from '@/lib/elysia-plugins';
import { productsApp } from '@/modules/products';
import { organizationsApp } from '@/modules/admin/organizations';
import { ipRateLimiterMiddleware } from '@/middleware/public-middleware';
import { authMiddleware } from '@/middleware/auth-middleware';

const publicRoutes = new Elysia()
  .use(corsPlugin)
  .use(ipRateLimiterMiddleware)
  .use(productsApp)
  .all('/auth/*', betterAuthView, betterAuthRouteHook);

const protectedRoutes = new Elysia().use(authMiddleware).use(organizationsApp);

export const app = new Elysia({ prefix: '/api' })
  .use(openapiPlugin)
  .use(publicRoutes)
  .use(protectedRoutes);

app.listen(env.APP_PORT);

if (!env.isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}

export type App = typeof app;
