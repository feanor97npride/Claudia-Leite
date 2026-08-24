import pg, { Pool } from 'pg';

// DATE columns default to being parsed into JS Date objects, which then
// serialize to full ISO timestamps ("2026-08-01T00:00:00.000Z") over JSON —
// but every date field throughout this app (frontend and server) is a plain
// "YYYY-MM-DD" string used in direct lexical comparisons and re-parsed via
// `new Date(iso + 'T00:00:00')`. Returning the raw wire string instead keeps
// that contract intact everywhere.
pg.types.setTypeParser(1082, (val) => val);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local for local development.');
}

// A single pool per process. On Vercel, each serverless function invocation
// reuses the pool across warm invocations of the same instance; cold starts
// create a fresh one. Small `max` keeps us well under typical hosted
// Postgres connection limits.
export const pool = new Pool({ connectionString, max: 5 });
