import type { IncomingMessage, ServerResponse } from 'node:http';
import { pool } from '../server/db.js';
import { sendJson, withErrorHandling, requireAuth } from '../server/http.js';

/** TEMPORARY diagnostic endpoint — reports exactly what the running
 *  serverless function's own pool sees (database/schema identity and the
 *  atividades table's actual columns), to rule out any "which database" or
 *  "which branch" ambiguity once and for all. Remove after use. */
export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  await requireAuth(req);
  const { rows } = await pool.query(`
    select
      current_database() as db,
      current_schema() as schema,
      inet_server_addr()::text as server_addr,
      (select string_agg(column_name, ', ' order by ordinal_position)
         from information_schema.columns
        where table_name = 'atividades') as atividades_columns
  `);
  sendJson(res, 200, { info: rows[0] });
});
