import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './db.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Postgres error codes for "this already exists" (duplicate_column,
// duplicate_table, duplicate_object) — production had migrations 001-003's
// actual schema changes applied from BEFORE the schema_migrations tracking
// table existed, so their rows were never recorded. Re-running one of them
// then fails with exactly one of these codes even though nothing is
// actually wrong; treating it as "already applied" (mark done, move on)
// instead of a hard failure lets the runner catch up and reach whatever
// migration is genuinely still pending, instead of getting stuck forever
// on the first untracked-but-already-applied file.
const ALREADY_EXISTS_CODES = new Set(['42701', '42P07', '42710']);

function isAlreadyExistsError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && ALREADY_EXISTS_CODES.has(String((err as { code: unknown }).code));
}

/**
 * Applies any migration file not yet recorded, in filename order, each in
 * its own transaction. Purely additive migrations (see migrations/*.sql) —
 * safe to re-run; already-applied files are skipped (Bloco 3.1/3.2). Does
 * NOT end the pool — reused both by the CLI script (server/migrate.ts,
 * which does end it) and the temporary admin API route, which shares the
 * app's long-lived pool.
 */
export async function applyPendingMigrations(): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map(
        (r) => r.filename,
      ),
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        newlyApplied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        if (!isAlreadyExistsError(err)) throw err;
        // The schema change is already there; just record it as applied
        // (own transaction, since the failed one was rolled back) and keep
        // going instead of blocking every migration after this one.
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      }
    }
    return newlyApplied;
  } finally {
    client.release();
  }
}
