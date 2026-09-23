import { test } from 'bun:test';
import { treaty } from '@elysia/eden';
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

export const authRoutes = new Elysia({ prefix: '/auth' }).mount(auth.handler);

export type AuthRoutes = typeof authRoutes;
