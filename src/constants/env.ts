const require = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
};

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const frontEndUrl = process.env.FRONT_END_URL ?? 'http://localhost:5173';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  APP_URL: appUrl,
  APP_PORT: Number(process.env.APP_PORT ?? 3000),

  FRONT_END_URL: frontEndUrl,

  DATABASE_URL: require('DATABASE_URL') ?? "postgres://kkp:kkp_dev_secret@localhost:5433/kkp_dev",
  REDIS_URL: require('REDIS_URL'),

  BETTER_AUTH_SECRET:
    process.env.NODE_ENV === 'production'
      ? require('BETTER_AUTH_SECRET')
      : (process.env.BETTER_AUTH_SECRET ??
        '36ed5037ed7b64493eb960d042b242c1fbeb51d88011734d0fb7758059d5183b'),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string ?? '',

  CORS_ORIGIN_ALLOWED: [appUrl, frontEndUrl] as string[],

  get isProduction() {
    return this.NODE_ENV === 'production';
  },
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
  get isTest() {
    return this.NODE_ENV === 'test';
  },
} as const;
