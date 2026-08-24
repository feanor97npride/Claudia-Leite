import type { IncomingMessage, ServerResponse } from 'node:http';
import { pool } from '../../server/db';
import { hashPassword, validatePasswordPolicy, type Role } from '../../server/auth';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth, requireRole } from '../../server/http';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);
  requireRole(user, 'admin'); // Bloco 0.2: only Admin can view/create/edit other users

  if (req.method === 'GET') {
    const { rows } = await pool.query(
      'SELECT id, email, display_name, role, must_change_password, created_at FROM users ORDER BY created_at ASC',
    );
    sendJson(res, 200, { users: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    const displayName = String(body.displayName ?? '').trim();
    const password = String(body.password ?? '');
    const role = body.role as Role;

    if (!email) throw new HttpError(400, 'E-mail é obrigatório.');
    if (!displayName) throw new HttpError(400, 'Nome é obrigatório.');
    if (role !== 'admin' && role !== 'viewer') throw new HttpError(400, 'Role inválida.');
    const policyError = validatePasswordPolicy(password);
    if (policyError) throw new HttpError(400, policyError);

    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing[0]) throw new HttpError(409, 'Já existe um usuário com esse e-mail.');

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role, must_change_password)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, display_name, role, must_change_password, created_at`,
      [email, passwordHash, displayName, role],
    );
    sendJson(res, 201, { user: rows[0] });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
