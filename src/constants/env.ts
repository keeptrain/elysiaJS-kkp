export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const frontEndUrl = process.env.FRONT_END_URL ?? 'http://localhost:3000';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  APP_URL: appUrl,
  APP_PORT: Number(process.env.APP_PORT ?? 3000),

  FRONT_END_URL: frontEndUrl,

  DATABASE_URL: process.env.DATABASE_URL!,

  REDIS_URL: process.env.REDIS_URL!,

  // CORS
  CORS_ORIGIN_ALLOWED: [appUrl, frontEndUrl] as string[],

  // Better Auth Package (dev fallback acak — prod wajib isi via env)
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ??
    '36ed5037ed7b64493eb960d042b242c1fbeb51d88011734d0fb7758059d5183b',

  // Google (kosong = OAuth Google nonaktif sampai kredensial asli diisi via env)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',

  isProduction,
  isDevelopment,
  isTest,
} as const;
