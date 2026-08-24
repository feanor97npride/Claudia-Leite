import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyPassword, setPassword, validatePasswordPolicy } from '../../server/auth';
import { pool } from '../../server/db';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
  const user = await requireAuth(req);
  const body = await readJsonBody(req);
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) throw new HttpError(400, policyError);

  const { rows } = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [
    user.id,
  ]);
  const ok = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!ok) throw new HttpError(401, 'Senha atual incorreta.');

  await setPassword(user.id, newPassword);
  sendJson(res, 200, { ok: true });
});
