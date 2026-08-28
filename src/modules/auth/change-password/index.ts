import { Elysia } from 'elysia';
import { authMiddleware } from '../../../middleware/auth-middleware';

export const changePasswordRoute = '/change-password' as const;

export const changePasswordApp = new Elysia()
  .use(authMiddleware)
  .post(changePasswordRoute, ({ userId }) => userId);
