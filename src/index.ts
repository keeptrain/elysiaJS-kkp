import { Elysia } from 'elysia';

import { isProduction, env } from '@/constants/env';
import { betterAuthRouteHook, betterAuthView } from '@/modules/auth/utils';
import { corsPlugin, openapiPlugin } from '@/lib/elysia-plugins';
import { productsApp } from '@/modules/products';
import { ipRateLimiterMiddleware } from '@/middleware/public-middleware';
import { authMiddleware } from '@/middleware/auth-middleware';

const publicRoutes = new Elysia()
  .use(corsPlugin)
  .use(ipRateLimiterMiddleware)
  .use(productsApp)
  .all('/api/auth/*', betterAuthView, betterAuthRouteHook);

export const protectedRoutes = new Elysia().use(authMiddleware);

export const app = new Elysia()
  .use(openapiPlugin)
  .use(publicRoutes)
  .use(protectedRoutes);

app.listen(env.APP_PORT);

if (!isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}
