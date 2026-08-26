import type { IncomingMessage, ServerResponse } from 'node:http';
import { applyPendingMigrations } from '../server/migrations.js';
import { sendJson, withErrorHandling, HttpError, requireAuth, requireRole } from '../server/http.js';

/**
 * TEMPORARY, admin-only: applies any pending migration (see migrations/*.sql)
 * against whatever DATABASE_URL this deployment already has — needed
 * because Vercel's "sensitive" env vars can't be viewed/copied from the
 * dashboard, so `npm run db:migrate` can't be run locally against
 * production. Remove this file once migration 005_atividade_subtasks.sql
 * has been confirmed applied in production; it should never stay a
 * permanent part of the API surface (an authenticated admin could reach it,
 * but it's still a "run arbitrary migration files" endpoint, minimized by
 * having none pending most of the time — best kept off once no longer
 * needed).
 */
export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);
  requireRole(user, 'admin');

  if (req.method !== 'GET' && req.method !== 'POST') {
    throw new HttpError(405, 'Método não permitido.');
  }

  const applied = await applyPendingMigrations();
  sendJson(res, 200, { applied, message: applied.length === 0 ? 'Nenhuma migration pendente.' : 'Migrations aplicadas.' });
});
