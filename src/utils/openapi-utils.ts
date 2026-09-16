import type { OpenAPIV3_1 } from 'openapi-types';

import { auth } from '@/lib/auth';
import { RELEVANT_AUTH_PATHS } from '@/modules/auth/utilts';

// OpenAPI integration untuk @elysia/openapi — butuh plugin openAPI()
// di lib/auth.ts agar auth.api.generateOpenAPISchema tersedia.
let _schema: Awaited<ReturnType<typeof auth.api.generateOpenAPISchema>>;
const getSchema = async () =>
  (_schema ??= await auth.api.generateOpenAPISchema());

// Better Auth generate OpenAPI 3.1 — pin ke tipe v3.1 agar `paths`/`components`
// di lib/elysia-plugins.ts match salah satu varian union `documentation`
// (Partial<OpenAPIV3.Document> | Partial<OpenAPIV3_1.Document>).
export const OpenAPI = {
  getPaths: (prefix = '/api/auth') =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);
      for (const path of Object.keys(paths)) {
        if (!RELEVANT_AUTH_PATHS.has(path)) continue;
        const key = prefix + path;
        reference[key] = paths[path];
        for (const method of Object.keys(paths[path])) {
          const operation = (
            reference[key] as unknown as Record<string, { tags?: string[] }>
          )[method];
          operation.tags = ['auth'];
        }
      }
      return reference;
    }) as Promise<OpenAPIV3_1.PathsObject>,
  components: getSchema().then(
    ({ components }) => components
  ) as Promise<OpenAPIV3_1.ComponentsObject>,
} as const;
