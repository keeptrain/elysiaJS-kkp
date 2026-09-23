## Rules

- please don't return so many text, response when result task or asking

## Project Architecture

- Using modular monolith architecture, each module has its own route, schema, and service.

### Architecture Rules

- When other modules need to use a other module's make a  `ModuleContract` to that module, not directly call the service or route. This is to keep the module independent and maintainable. And the module can be easily to separate to microservice in the future if needed.

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
  - beforeEach, selalu gunakan `await reset(db, { ...users, lalu schema/table related yang lagi diuji jangan reset semuanya.
- Tidak perlu:
  - 401 Unauthenticated already covered by `auth-middleware.test.ts`, no need to repeat in each module. 
  - 403 Unauthorized already covered by `auth-middleware.test.ts`, no need to repeat in each module.

### Test Structure

- describe(`<module-name> <integrations or services test>`, () => { 
  - describe('success ', () => { ... })
    - describe(`GET/POST/PATCH/DELETE <descriptive route name> absolute/route/name`, () => { ... })
      - (must) it('should return correct response', async () => { ... }) 
      - (if exist) it('should return correct response with query params', async () => { ... })
      - (if exist) it('should return correct response with body params', async () => { ... })
      - (if exist) it('should return correct response with path params', async () => { ... })
      - describe(`VALIDATION absolute/route/name`)
        - (if exists) it(`should [descriptive test] `, () => { ... })

## Code Generating

### Baca ini ketika melakukan generating code untuk `modules/<module-name>/index.ts
- Tempat ini digunakan untuk yang berkaitan dengan controller pattern , seperti:
Validasi params, body, query params, dll yang schemanya di simpan di `modules/<module-name>/model.ts`
- Mendefinisikan plugins yang dibutuhkan seperti auth `use(betterAuth)` , `use(authorizationMiddleware)` untuk router dengan akses tertentu

### Baca ini ketika melakukan generating code untuk `modules/<module-name>/service.ts
- Tempat ini digunakan untuk yang berkaitan untuk logic bisnis manipulasi hasil return agar handler menerima final result
- Main kode buat sebagai const `<module-name>Service` dengan isi object 
 -  function `descriptiveNameRelated` 
- Lakukan db.select selective mungkin agar performa oke 
- Buat se-reusable mungkin misal masih related service bukan antar module, buat dulu function tersendiri untuk ambil/cek database tersebut

## After Code Generating

- Buat test dengan menghandle cases yang ada di route, service tersebut , lihat kembali ## Test
- Always `bunx tsc --noEmit`, jangan sampai ada error di tsc.
