## Rules

- please don't return so many text,response when result task or asking

## Project Architecture

- Using modular monolith architecture, each module has its own route, schema, and service.

### Architecture Rules

- When other modules need to use a other module's make a request to that module's route, not directly call the service. This is to keep the module independent and maintainable. And the module can be easily to separate to microservice in the future if needed.

## Tech Stack

- Runtime: Bun `1.4.0` (always using `bun` or `bunx`).
- Language: TypeScript 
  - Strict : true
  - NoImplicitAny : true
- Framework: Elysia (`latest`)
  - Typebox schema validation.
  - `@elysia/openapi` (`openapiPlugin`, UI Scalar di `/openapi`, JSON di `/openapi/json`).
- Database: Postgres:16-alpine
  - Running in container on host port 5433 (dev) / 5432 (staging/prod). 
  - ORM: `drizzle-orm`
- Database in-memory cache: Upstash Redis (free plan)
- Code linter & formatter: Biome

### Authentication

- Better Auth agnostic library

#### Enabled methods

- Email OTP (Gmail-only, via Resend API)
- Google OAuth (via `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`)

## App (`src/`)

- `index.ts`: listen port.
- `app.ts`: managing elysia apps, routes, middlewares, plugins, cors, rate-limit, openapi.

### Modules (`src/modules/<module-name>/`)

#### Pattern creation
- `src/modules/<module-name>/index.ts` (route actions)
- `src/modules/<module-name>/schema.ts` (typebox schema)
- `src/modules/<module-name>/service.ts` (business logic, db query)

#### Pattern usage

- `src/modules/<module-name>/service` (route actions)

## Test

- Location `modules/<modul>/_test/*.test.ts`. 

### Test Rules

- Jalankan hanya folder/file modul yang diubah/sedang dibuat testnya (`bun test src/modules/<modul-name>/_test`), JANGAN full suite / multi-modul — setiap run memakan kuota request Upstash Redis.
- Pakai `const api = treaty(app).api;` untuk request type-safe (body valid) per route action.
  - How to use: `const res = await api.<route-action>({ body / query, params : { ... } }, { headers });`
- Gunakan `let test: TestHelpers;
  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });` sesudah describe awal

### Test Structure

- describe(`<module-name> <integrations or services test>`, () => { 
  - describe('success ', () => { ... })
    - describe(`<descriptive route name> get`, () => { ... })
      - (must) it('should return correct response', async () => { ... }) 
      - (if exist) it('should return correct response with query params', async () => { ... })
      - (if exist) it('should return correct response with body params', async () => { ... })
      - (if exist) it('should return correct response with path params', async () => { ... })
      - (if exists) describe('body validation', () => { ... })
      - (if exists) describe('query validation', () => { ... })
      - (if exists) describe('path validation', () => { ... })
    - if the module has other route actions, add describe for each action:
    - describe(`<descriptive route name> post`, () => { ... })
      - (must) it('should return correct response', async () => { ... }) 
      - (if exists) describe('body validation', () => { ... })
      - (if exists) describe('query validation', () => { ... })
      - (if exists) describe('path validation', () => { ... })
    - describe(`patch`, () => { ... })
      - (if exists) describe('body validation', () => { ... })
      - (if exists) describe('query validation', () => { ... })
      - (if exists) describe('path validation', () => { ... })
    - describe(`delete`, () => { ... })
      - (if exists) describe('body validation', () => { ... })
      - (if exists) describe('query validation', () => { ... })
      - (if exists) describe('path validation', () => { ... })
  - describe('authorization', () => { ... })
    - 401 Unauthenticated already covered by `auth-middleware.test.ts`, no need to repeat in each module. 
    - 403 Unauthorized already covered by `auth-middleware.test.ts`, no need to repeat in each module.

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
