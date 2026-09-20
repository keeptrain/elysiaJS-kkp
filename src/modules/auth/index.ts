import Elysia, { t } from 'elysia';
import { auth } from '@/lib/auth';

const signInEmailOtpBody = t.Object({
  email: t.String({ format: 'email' }),
  otp: t.String({ minLength: 6, maxLength: 6 }),
});

const signInSocialBody = t.Object({
  provider: t.Literal('google'),
  callbackURL: t.Optional(t.String({ format: 'uri' })),
});

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post(
    '/sign-in/email-otp',
    ({ body }) =>
      auth.api.signInEmailOTP({
        body,
      }),
    {
      body: signInEmailOtpBody,
    }
  )
  .post(
    '/sign-in/social',
    ({ body }) =>
      auth.api.signInSocial({
        body,
      }),
    {
      body: signInSocialBody,
    }
  )
  .get('/get-session', ({ headers }) =>
    auth.api.getSession({
      headers: new Headers(headers as HeadersInit),
    })
  )
  .post('/sign-out', ({ headers }) =>
    auth.api.signOut({
      headers: new Headers(headers as HeadersInit),
    })
  );

export type AuthRoutes = typeof authRoutes;
