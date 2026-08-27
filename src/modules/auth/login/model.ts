import { t } from 'elysia';

export const models = {
  body: t.Object({
    email: t.String({
      minLength: 8,
      maxLength: 50,
      format: 'email',
      pattern: '^[^\\s@]+@gmail\\.com$',
      error: 'Invalid email format',
    }),
  }),
};
