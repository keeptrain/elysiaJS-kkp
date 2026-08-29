import { t } from 'elysia';

const emailSchema = t.String({
  minLength: 8,
  maxLength: 50,
  format: 'email',
  pattern: '^[^\\s@]+@gmail\\.com$',
  error: 'Invalid email format',
});

export const models = {
  body: t.Object({
    email: emailSchema,
    otp: t.Optional(
      t.String({
        minLength: 6,
        maxLength: 6,
        pattern: '^[0-9]{6}$',
        error: 'Invalid OTP format',
      })
    ),
  }),
} as const;
