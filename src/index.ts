import { Elysia } from 'elysia';

import { isProduction, env } from './utils/env';
import { loginApp } from './modules/auth/login/index';
import { productsApp } from './modules/products';
import { publicMiddleware } from './middleware/public-middleware';
import { authMiddleware } from './middleware/auth-middleware';

const PORT = env.PORT;

const publicRoutes = new Elysia()
  .use(publicMiddleware)
  .use(productsApp)
  .use(loginApp);

export const protectedRoutes = new Elysia().use(authMiddleware);

export const app = new Elysia().use(publicRoutes).use(protectedRoutes);

app.listen(PORT);

if (!isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}
