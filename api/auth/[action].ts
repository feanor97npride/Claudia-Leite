import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  login,
  createSession,
  sessionCookieHeader,
  destroySession,
  clearSessionCookieHeader,
  parseCookie,
  SESSION_COOKIE_NAME,
  verifyPassword,
  setPassword,
  validatePasswordPolicy,
} from '../../server/auth.js';
import { pool } from '../../server/db.js';
import {
  readJsonBody,
  sendJson,
  withErrorHandling,
  HttpError,
  requireAuth,
  getAuthedUser,
} from '../../server/http.js';

// Vercel has a hard cap of 12 Serverless Functions per deployment on the
// Hobby plan — the 4 auth endpoints (login/logout/me/change-password) are
// merged into this single dynamic-segment route (same pattern already used
// by /api/objetivos/[id].ts) instead of one file each, to leave headroom
// for the rest of the app to keep growing.
function actionFromUrl(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1]);
}

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const action = actionFromUrl(req.url ?? '');

  if (action === 'login') {
    if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    const body = await readJsonBody(req);
    const email = String(body.email ?? '');
    const password = String(body.password ?? '');

    const user = await login(email, password);
    if (!user) {
      // Deliberately generic — never reveals whether the email exists or the
      // password was wrong, to avoid user enumeration (Bloco 0.1).
      sendJson(res, 401, { error: 'Usuário ou senha inválidos.' });
      return;
    }

    const { token, expiresAt } = await createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookieHeader(token, expiresAt));
    sendJson(res, 200, { user });
    return;
  }

  if (action === 'logout') {
    if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    const token = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    if (token) await destroySession(token);
    res.setHeader('Set-Cookie', clearSessionCookieHeader());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (action === 'me') {
    if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const user = await getAuthedUser(req);
    sendJson(res, 200, { user });
    return;
  }

  if (action === 'change-password') {
    if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
    const user = await requireAuth(req);
    const body = await readJsonBody(req);
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) throw new HttpError(400, policyError);

    const { rows } = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id],
    );
    const ok = await verifyPassword(currentPassword, rows[0].password_hash);
    if (!ok) throw new HttpError(401, 'Senha atual incorreta.');

    await setPassword(user.id, newPassword);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(404, 'Rota não encontrada.');
});
