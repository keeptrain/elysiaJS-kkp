import { Elysia } from 'elysia';
import { models } from './model';
import { LoginService } from './service';

export const loginRoute = '/login' as const;

export const loginApp = new Elysia().post(
  loginRoute,
  async ({ body, server }) => {
    const { email } = body;

    const isLoginSuccessful = await LoginService.login(email);

    if (!isLoginSuccessful) {
      return {
        message: 'Invalid email or password',
      };
    }

    return {
      message: `Login successful for email: ${email}`,
    };
  },
  {
    body: models.body,
  }
);
