import { cors } from '@elysiajs/cors';
import { openapi } from '@elysia/openapi';
import { env } from '@/constants/env';
import { OpenAPI } from '@/utils/openapi-utils';

export const corsPlugin = cors({
  origin: env.CORS_ORIGIN_ALLOWED,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export const openapiPlugin = openapi({
  documentation: {
    info: {
      title: 'KKP API',
      version: '1.0.0',
      description: 'API Documentations',
    },
    tags: [{ name: 'auth', description: 'Autentikasi (Better Auth)' }],
    paths: await OpenAPI.getPaths(),
    components: await OpenAPI.components,
  },
});
