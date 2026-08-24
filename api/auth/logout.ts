import type { IncomingMessage, ServerResponse } from 'node:http';
import { destroySession, clearSessionCookieHeader, parseCookie, SESSION_COOKIE_NAME } from '../../server/auth.js';
import { sendJson, withErrorHandling, HttpError } from '../../server/http.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Método não permitido.');
  const token = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  if (token) await destroySession(token);
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  sendJson(res, 200, { ok: true });
});
