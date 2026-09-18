import { defineConfig } from 'drizzle-kit';
import { env } from './src/constants/env';

export default defineConfig({
  out: './drizzle',
  schema: ['./src/db/auth-schema.ts', './src/db/schema.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
