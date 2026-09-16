export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.APP_PORT ?? 3000),
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  isProduction,
  isDevelopment,
  isTest,
} as const;
