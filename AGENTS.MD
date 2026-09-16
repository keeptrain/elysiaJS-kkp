## Rules

- please don't return so many text when result task is just a single line code
- always bun package manager

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
- NOTE: app memakai drizzle `pg` (`src/lib/pg-db.ts`, tabel `users`+`otps` di postgres via `DATABASE_URL`). Sessions tidak di DB — pakai `SessionStore` (`src/lib/session-store.ts`, in-memory, siap diganti Upstash/Redis). `bun test` me-load `.env.test` (`NODE_ENV=test`); jangan arahkan ke db prod/staging karena test menghapus isi tabel.
