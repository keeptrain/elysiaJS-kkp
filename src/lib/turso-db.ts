import { createClient } from '@libsql/client';

const libsqlUrl = process.env.TURSO_DATABASE_URL!.replace(
  /^turso:\/\//,
  'libsql://'
);

export const tursoDb = createClient({
  url: libsqlUrl,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
