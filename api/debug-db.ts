import type { IncomingMessage, ServerResponse } from 'node:http';
import { pool } from '../server/db.js';
import { sendJson, withErrorHandling, requireAuth, requireRole, HttpError } from '../server/http.js';

const CHECK_SQL = `
  select
    current_database() as db,
    current_schema() as schema,
    inet_server_addr()::text as server_addr,
    (select string_agg(column_name, ', ' order by ordinal_position)
       from information_schema.columns
      where table_name = 'atividades') as atividades_columns
`;

/** TEMPORARY diagnostic endpoint. GET reports exactly what the running
 *  serverless function's own pool sees. POST applies the additive fix
 *  (add week_start if missing) through that SAME pool, removing any doubt
 *  about "which database" the app is actually using — then re-runs the
 *  check so the response confirms the fix landed. Remove after use. */
export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);

  if (req.method === 'GET') {
    const { rows } = await pool.query(CHECK_SQL);
    sendJson(res, 200, { info: rows[0] });
    return;
  }

  if (req.method === 'POST') {
    requireRole(user, 'admin');
    await pool.query('ALTER TABLE atividades ADD COLUMN IF NOT EXISTS week_start DATE');
    const { rows } = await pool.query(CHECK_SQL);
    sendJson(res, 200, { info: rows[0] });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
