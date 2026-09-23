#!/usr/bin/env bun
/**
 * Generate backend `.d.ts` types & copy langsung ke frontend.
 *
 * Usage:
 *   bun run sync:types
 *   bun run sync:types ~/developer/frontend/react-kkp
 *   FRONTEND_DIR=~/developer/frontend/react-kkp bun run sync:types
 */
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const BACKEND_ROOT = resolve(import.meta.dir, '..');
const FRONTEND_DIR = resolve(
  process.argv[2] ??
    process.env.FRONTEND_DIR ??
    join(process.env.HOME ?? '~', 'developer/frontend/react-kkp')
);
const DEST_DIR = join(FRONTEND_DIR, 'src/lib/backend-types');
const OUT_DIR = join(BACKEND_ROOT, 'tmp/backend-types');

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (full.endsWith('.d.ts')) yield full;
  }
}

/** Rewrite `@/x` jadi relative path dari posisi file. */
function rewriteAliases(source: string, fromFile: string): string {
  return source.replace(/(['"])@\/([^'"]+)\1/g, (_m, quote, p) => {
    let rel = relative(dirname(fromFile), join(OUT_DIR, p)).replaceAll(
      '\\',
      '/'
    );
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return `${quote}${rel}${quote}`;
  });
}

async function main() {
  const eden = join(FRONTEND_DIR, 'src/lib/eden.ts');
  try {
    await stat(eden);
  } catch {
    console.error(
      `FRONTEND_DIR tidak valid (${FRONTEND_DIR}): src/lib/eden.ts tidak ditemukan.`
    );
    process.exit(1);
  }

  console.log('1/3 Emit .d.ts backend...');
  const proc = Bun.spawn(['bunx', 'tsc', '-p', 'tsconfig.backend-types.json'], {
    cwd: BACKEND_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if ((await proc.exited) !== 0) {
    console.error('tsc emit gagal.');
    process.exit(1);
  }

  console.log('2/3 Rewrite alias @/ -> relative...');
  let count = 0;
  for await (const file of walk(OUT_DIR)) {
    const raw = await readFile(file, 'utf8');
    if (!raw.includes('@/')) continue;
    await writeFile(file, rewriteAliases(raw, file));
    count++;
  }
  console.log(`    ${count} file di-rewrite.`);

  console.log(`3/3 Copy ke ${DEST_DIR}...`);
  await rm(DEST_DIR, { recursive: true, force: true });
  await Bun.$`cp -r ${OUT_DIR}/ ${DEST_DIR}`.cwd(BACKEND_ROOT);

  console.log(
    '\nSelesai. Pastikan frontend punya dep `elysia` (untuk `import { Elysia } from "elysia"` di app.d.ts):'
  );
  console.log('  cd ~/developer/frontend/react-kkp && pnpm add elysia@latest');
}

await main();
