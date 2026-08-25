import type { IncomingMessage, ServerResponse } from 'node:http';
import { pool } from '../server/db.js';
import { sendJson, withErrorHandling, HttpError, requireAuth, requireRole } from '../server/http.js';

// TEMPORARY diagnostic/fix endpoint — same technique used earlier in this
// project to resolve the week_start "phantom missing column" mystery: when
// external tools (psql, the Neon SQL Editor) disagree with what the app's
// own live connection sees, the reliable move is to inspect/mutate through
// that exact same connection, removing all ambiguity about "which
// database". Admin-gated for the POST (the only mutating action); removed
// once confirmed fixed.
export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);

  if (req.method === 'GET') {
    const info = await pool.query(
      `SELECT current_database() AS db, current_schema() AS schema, inet_server_addr()::text AS server_addr,
              inet_server_port() AS server_port`,
    );
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    sendJson(res, 200, { connection: info.rows[0], tables: tables.rows.map((r) => r.table_name) });
    return;
  }

  if (req.method === 'POST') {
    requireRole(user, 'admin');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id text PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start date NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS reports_user_week_idx ON reports(user_id, week_start DESC);
      INSERT INTO schema_migrations (filename) VALUES ('004_reports.sql') ON CONFLICT (filename) DO NOTHING;
    `);
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    sendJson(res, 200, { ok: true, tables: tables.rows.map((r) => r.table_name) });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
