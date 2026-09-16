
FROM oven/bun:1 AS base

WORKDIR /usr/src/app

COPY package.json bun.lock ./

# ---- dev: full deps + hot reload ----
FROM base AS dev

RUN bun install --frozen-lockfile

COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

ENV NODE_ENV=development
CMD ["bun", "run", "--watch", "src/index.ts"]
EXPOSE 3000

# ---- prod: compile to binary (Elysia recommended) ----
FROM oven/bun:1 AS build

WORKDIR /usr/src/app

# Cache packages installation
COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install --frozen-lockfile

COPY ./src ./src

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	src/index.ts

FROM gcr.io/distroless/base AS prod
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/server server

ENV NODE_ENV=production
CMD ["./server"]
EXPOSE 3000
