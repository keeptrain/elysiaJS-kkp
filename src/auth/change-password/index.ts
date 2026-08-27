import Elysia, { t } from 'elysia';

export const changePasswordRoute = '/auth/change-password' as const;

export const changePasswordApp = new Elysia().get(
  changePasswordRoute,
  () => 'asdas'
);
