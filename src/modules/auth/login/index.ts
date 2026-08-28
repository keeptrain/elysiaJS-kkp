import { Elysia } from 'elysia';
import { models } from './model';
import { LoginService } from './service';

export const loginRoute = '/login' as const;

export const loginApp = new Elysia().post(
  loginRoute,
  async ({ body }) => {
    const { email } = body;

    await LoginService.login(email);

    return {
      data: {
        email,
      },
      message: 'Login berhasil, silakan cek email Anda untuk kode OTP.',
    };
  },
  {
    body: models.body,
  }
);
