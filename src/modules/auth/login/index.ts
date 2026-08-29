import { Elysia, status } from 'elysia';
import { models } from './model';
import { LoginService } from './service';

export const loginRoute = '/login' as const;

export const loginApp = new Elysia().post(
  loginRoute,
  async ({ body, cookie }) => {
    const email = body.email;
    if (!('otp' in body && body.otp)) {
      await LoginService.sendingOtp(email);
      return {
        data: {
          email,
        },
        message: 'Login berhasil, silakan cek email Anda untuk kode OTP.',
      };
    } else {
      const isValid = await LoginService.verifyOtp(email, body.otp);

      if (!isValid) {
        return status(401, {
          message: 'OTP tidak valid atau sudah kadaluarsa.',
        });
      }

      const { token, maxAge } = await LoginService.createSession(email);

      cookie.session.set({
        value: token,
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: maxAge > 0 ? maxAge : 86400, // default to 1 day if maxAge is not positive
      });

      return {
        message: 'Login successful, OTP verified.',
      };
    }
  },
  {
    body: models.body,
  }
);
