## Rules

- please don't return so many text when result task is just a single line code
- always bun package manager

## Tech Stack

- Runtime: Bun `1.4.0` (package manager selalu `bun`, jangan npm/yarn/pnpm).
- Bahasa: TypeScript (`target` ES2021, `module` ES2022, `strict` true).
- Framework: Elysia (`latest`) + plugin `@elysiajs/cors` (`corsPlugin`) dan `@elysia/openapi` (`openapiPlugin`, UI Scalar di `/openapi`, JSON di `/openapi/json`).
- Auth: `better-auth@1.7.5` (`src/lib/auth.ts`, `drizzleAdapter` pg, plugin `openAPI()` + `emailOTP` OTP 6 digit/5 menit + Google OAuth). Gmail-only (`@gmail.com`) ditegakkan di edge (`betterAuthView` di `src/utils/auth-utils.ts`). Session 1 hari + `cookieCache` 5 menit.
- DB: Postgres via `postgres@3.4.9` + `drizzle-orm` (`src/lib/pg-db.ts`, `DATABASE_URL`). `drizzle-kit` untuk generate/migrate/push (`out: ./drizzle`, schema hanya `./src/db/auth-schema.ts`, dialect postgresql).
- Mail OTP: `resend@6.24.0` di production; non-prod tulis html ke `tmp/otp-mail/` (`src/lib/resend-mailer.ts`).
- Rate limit: in-memory 1 req/menit per IP (`InMemoryRateLimiter`, `publicMiddleware` global `onBeforeHandle`; mati saat `NODE_ENV=test`).
- Docs OpenAPI Better Auth: hanya `RELEVANT_AUTH_PATHS` yang di-merge (`src/utils/openapi-utils.ts`, pin tipe OpenAPI 3.1 via `openapi-types` devDep).
- Formatter: Prettier (`bun run format` / `format:check`).

## Test Standard (`*_test/*.test.ts`, contoh: `src/modules/admin/organizations/_test/index.test.ts`)

- Lokasi: `<modul>/_test/*.test.ts`. Jalankan hanya folder modul tersebut (`bun test src/modules/admin/organizations/_test`), bukan full suite.
- Struktur `describe`: `auth (401)` → `body validation (422)` → `happy path` → `edge cases`.
- Route action-based: pakai `treaty(app).api` untuk body valid (type-safe per action); pakai `app.handle(new Request(...))` + JSON mentah untuk body invalid (422, bypass type treaty).
- Auth di test: `test.createUser` + `saveUser` → `getAuthHeaders({ userId })` → konversi ke plain object (`Object.fromEntries(headers.entries())`) untuk treaty; `test.deleteUser` setelah selesai.
- Cleanup: `beforeEach` hapus isi tabel modul + `cleanAuthDb()` bila sentuh tabel auth.
- Ekspektasi status: `401` tanpa session, `422` body di luar union/kurang field, `404` data tidak ketemu (jangan return `null` — Elysia serialize jadi body kosong), `200` happy path.

## App Map (`src/`)

- `index.ts`: wiring saja (`openapiPlugin` → `publicRoutes` → `protectedRoutes`, `app.listen(env.APP_PORT)`).
- `lib/`: `auth.ts` (config better-auth), `pg-db.ts`, `resend-mailer.ts`, `elysia-plugins.ts` (`corsPlugin` + `openapiPlugin`).
- `utils/`: `env.ts` (`APP_URL`/`APP_PORT`, `CORS_ORIGIN_ALLOWED`), `auth-utils.ts` (`GMAIL_ONLY`, `RELEVANT_AUTH_PATHS`, `betterAuthView`, `betterAuthRouteHook`), `openapi-utils.ts` (`OpenAPI`), `in-memory-rate-limiter.ts`, `routes.ts`, `utils.ts`.
- `middleware/`: `public-middleware.ts` (rate-limit, `decorate` `getDate`+`limiter`), `auth-middleware.ts` (`resolve` scoped → `{ userId, user, session }`, 401 tanpa session).
- `modules/products/`: contoh route publik `GET /products` (dummy, belum ke DB).
- `db/`: `auth-schema.ts` dipakai; `schema.ts` belum diimport siapa pun.
- Route publik: `cors` + rate-limit + `productsApp` + `.all('/api/auth/*')` (catch-all semua method ke Better Auth, `hide: true` dari docs). Route proteksi: `authMiddleware`.

## Env & Commands

- Jalankan dev: `bun run --watch src/index.ts` (atau script `bun run dev`); DB via `.docker/` (lihat bawah).
- Env wajib: `DATABASE_URL`, `APP_URL`, `APP_PORT`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`. File: `.env` (prod), `.env.development`, `.env.staging`, `.env.test` (bun test me-load otomatis).
- DB: `bun run db:generate` / `db:migrate` / `db:push` (butuh `DATABASE_URL`).
- Typecheck: `bunx tsc -p tsconfig.json` RUSAK (error pra-ada `moduleResolution=node10` dihapus TS baru) — pakai `bunx tsc --ignoreConfig --noEmit --strict --skipLibCheck --module esnext --target es2021 --moduleResolution bundler --types bun-types <files>`; `bun build` hanya bundling, bukan typecheck.

## Gotchas

- `FRONTEND_URL` (`.env.*`, tanpa underscore) vs `FRONT_END_URL` (`src/utils/env.ts`, pakai underscore) — mismatch, sehingga `CORS_ORIGIN_ALLOWED` jatuh ke fallback `localhost:3000`. `trustedOrigins` di `auth.ts` memakai `FRONTEND_URL` yang benar.
- `LOCAL_DB` / `TURSO_*` di `.env.*` dan komentar "SQLite/Turso" sudah basi — kode aktual hanya pakai Postgres (`pg-db.ts`); tidak ada kode yang membaca key tersebut.

## Containers (.docker/)

- Single multi-stage `Dockerfile`: `dev` (full deps + `--watch`) vs `prod` (`bun build --compile` → single binary on `gcr.io/distroless/base`).
- Base `compose.yaml` is never run directly; always combine with one overlay:
  - dev (app di host, db di container): `podman compose -f .docker/compose.yaml -f .docker/compose.dev.yaml up -d db` lalu `bun run --watch src/index.ts`
  - staging (app+db bareng, mirip prod): `podman compose -f .docker/compose.yaml -f .docker/compose.staging.yaml up --build -d`
  - prod (app+db bareng): `podman compose -f .docker/compose.yaml -f .docker/compose.prod.yaml up --build -d`
- Dev overlay: hanya service `db`, env dari `../.env.development`, postgres `kkp_dev` di host `:5433`, volume `pgdata_dev`. App host konek via `DATABASE_URL` (`localhost:5433`). Jangan `up` service `app` di dev (bentrok port 3000 host).
- Staging overlay: `target: prod`, `restart: unless-stopped`, env dari `../.env.staging`, postgres `kkp_staging` (host port commented out), volume `pgdata_staging`, app di host `:3001`. `NODE_ENV=staging` berperilaku seperti dev di kode; set `production` bila ingin persis prod.
- Prod overlay: `target: prod`, no source mounts (immutable build), `restart: unless-stopped`, env dari `../.env`, postgres `kkp` (host port commented out), volume `pgdata_prod`.
- `app` waits for `db` via `depends_on: service_healthy` (`pg_isready`).
- NOTE: auth via Better Auth (`src/lib/auth.ts`, drizzleAdapter `pg`, plugin emailOTP Gmail-only + Google OAuth, handler di `/api/auth/*` + CORS; Gmail-only ditegakkan di `betterAuthView` di `src/index.ts`). Tabel auth (`users`+`sessions`+`accounts`+`verifications`) di postgres via `DATABASE_URL`, skema di `src/db/auth-schema.ts` (relasi drizzle v1 dihapus — gunakan `defineRelations` bila butuh joins). `bun test` me-load `.env.test` (`NODE_ENV=test`, rate-limit dimatikan); jangan arahkan ke db prod/staging karena test menghapus isi tabel auth.
