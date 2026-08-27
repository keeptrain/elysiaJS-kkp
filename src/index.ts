import { Elysia } from 'elysia';

import { loginApp } from './modules/auth/login/index';
import { changePasswordApp } from './modules/auth/change-password/index';
import { publicMiddleware } from './middleware/public-middleware';
import { authMiddleware } from './middleware/auth-middleware';
import { productsApp } from './modules/products';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT ?? 3000);

const publicRoutes = new Elysia()
  .use(publicMiddleware)
  .get('/', ({ getDate }) => `Hello Elysia at ${getDate()}`)
  .use(productsApp)
  .use(loginApp);

const protectedRoutes = new Elysia().use(authMiddleware).use(changePasswordApp);

const app = new Elysia().use(publicRoutes).use(protectedRoutes).listen(PORT);

if (!isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}

export const testApp = new Elysia().use(publicRoutes);
