import { Elysia } from 'elysia';

import { isProduction, env } from './utils/env';
import { betterAuthRouteHook, betterAuthView } from './utils/auth-utils';
import { corsPlugin, openapiPlugin } from './lib/elysia-plugins';
import { productsApp } from './modules/products';
import { publicMiddleware } from './middleware/public-middleware';
import { authMiddleware } from './middleware/auth-middleware';

const publicRoutes = new Elysia()
  .use(corsPlugin)
  .use(publicMiddleware)
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
