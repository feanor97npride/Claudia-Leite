import type { IncomingMessage, ServerResponse } from 'node:http';
import { login, createSession, sessionCookieHeader } from '../../server/auth';
import { readJsonBody, sendJson, withErrorHandling, HttpError } from '../../server/http';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
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
});
