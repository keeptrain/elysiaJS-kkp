import { Elysia } from 'elysia';

import { loginApp } from './modules/auth/login/index';
import { changePasswordApp } from './modules/auth/change-password/index';
import { productsApp } from './modules/products';
import { publicMiddleware } from './middleware/public-middleware';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT ?? 3000);

const publicRoutes = new Elysia()
  .use(publicMiddleware)
  .use(productsApp)
  .use(loginApp);

const protectedRoutes = new Elysia().use(changePasswordApp);

export const app = new Elysia().use(publicRoutes).use(protectedRoutes);

app.listen(PORT);

if (!isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}
