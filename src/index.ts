import { Elysia } from 'elysia';

import { loginApp } from '../src/auth/login/index';
import { changePasswordApp } from '../src/auth/change-password/index';
import { publicMiddleware } from './middleware/public-middleware';
import { authMiddleware } from './middleware/auth-middleware';

const publicRoutes = new Elysia()
  .use(publicMiddleware)
  .get('/', ({ getDate }) => `Hello Elysia at ${getDate()}`);

const protectedRoutes = new Elysia()
  .use(authMiddleware)
  .use(loginApp)
  .use(changePasswordApp);

const app = new Elysia().use(publicRoutes).use(protectedRoutes).listen(3000);

console.log(
  `🦊 Elysia is running ats ${app.server?.hostname}:${app.server?.port}`
);

export const testApp = new Elysia().use(publicRoutes).listen(3000);
