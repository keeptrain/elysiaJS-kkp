import { app } from '@/app';
import { env } from '@/constants/env';

export type { App } from '@/app';
export { app };

app.listen(env.APP_PORT);

if (!env.isProduction) {
  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
  );
}
