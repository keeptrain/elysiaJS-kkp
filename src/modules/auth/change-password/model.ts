import { t } from 'elysia';

export const model = {
  body: t.Object({
    oldPassword: t.String(),
  }),
};
