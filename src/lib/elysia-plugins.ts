import { cors } from '@elysiajs/cors';
import { openapi } from '@elysia/openapi';
import { env } from '@/utils/env';
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
      description:
        'Dokumentasi route Elysia + Better Auth. ' +
        'Coba interaktif juga tersedia di `/api/auth/reference`.',
    },
    tags: [{ name: 'auth', description: 'Autentikasi (Better Auth)' }],
    paths: await OpenAPI.getPaths(),
    components: await OpenAPI.components,
  },
});
