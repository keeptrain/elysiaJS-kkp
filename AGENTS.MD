## Rules

- please don't return so many text when result task is just a single line code
- always bun package manager

## Containers (.docker/)

- Single multi-stage `Dockerfile`: `dev` (full deps + `--watch`) vs `prod` (`bun build --compile` → single binary on `gcr.io/distroless/base`).
- Base `compose.yaml` is never run directly; always combine with one overlay:
  - dev: `podman compose -f .docker/compose.yaml -f .docker/compose.dev.yaml up --build`
  - prod: `podman compose -f .docker/compose.yaml -f .docker/compose.prod.yaml up --build -d`
- Dev overlay: `target: dev`, bind-mounts `src/` (+ drizzle files) for hot-reload, `/usr/src/app/node_modules` anonymous volume, env from `../.env.development`, postgres `kkp_dev` on host `:5433`, volume `pgdata_dev`.
- Prod overlay: `target: prod`, no source mounts (immutable build), `restart: unless-stopped`, env from `../.env`, postgres `kkp` (host port commented out), volume `pgdata_prod`.
- `app` waits for `db` via `depends_on: service_healthy` (`pg_isready`).
- NOTE: app code is still SQLite/Turso (`src/lib/turso-db.ts`, drizzle `sqlite` dialect), so `DATABASE_URL` (postgres) is provisioned but unused until migrated to drizzle `pg`.
