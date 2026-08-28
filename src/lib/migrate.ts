import { readdir } from 'node:fs/promises';
import { tursoDb } from './turso-db';

// Jalankan semua .sql di database/migrations secara idempoten
// CREATE TABLE IF NOT EXISTS + IF NOT EXISTS membuat aman di-run setiap start
export async function runMigrations() {
  try {
    const files = await readdir('database/migrations');
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const path = `database/migrations/${file}`;
      const sql = await Bun.file(path).text();

      // Split sederhana: pisah per statement, tapi trigger mengandung ';' di dalam BEGIN...END
      // Strategy: split by ';\n' dan re-join trigger yang terpotong
      // Untuk Turso remote, batch lebih aman daripada single execute multi-statement
      const statements = splitSqlStatements(sql);

      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        await tursoDb.execute(stmt);
      }
      console.log(`[migrate] ${file} ok`);
    }
  } catch (err) {
    console.error('[migrate] failed', err);
    // jangan crash app di dev, tapi log — di production bisa throw
    if (process.env.NODE_ENV === 'production') throw err;
  }
}

if (import.meta.main) {
  await runMigrations();
  process.exit(0);
}

function splitSqlStatements(sql: string): string[] {
  // Hilangkan komentar baris -- dan trim
  const cleaned = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

  // Split trigger secara khusus: CREATE TRIGGER ... BEGIN ... END;
  // Kita split by ';' tapi gabungkan kembali jika di dalam BEGIN...END
  const parts: string[] = [];
  let current = '';
  let inTrigger = false;

  for (const line of cleaned.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase().startsWith('CREATE TRIGGER')) inTrigger = true;

    current += line + '\n';

    if (trimmed.endsWith(';')) {
      if (inTrigger) {
        if (trimmed.toUpperCase() === 'END;') {
          parts.push(current.trim());
          current = '';
          inTrigger = false;
        }
        // else masih di dalam trigger, jangan push
      } else {
        parts.push(current.trim());
        current = '';
      }
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts
    .map((s) => s.replace(/;$/, '').trim())
    .filter(Boolean)
    .map((s) => s + ';');
}
