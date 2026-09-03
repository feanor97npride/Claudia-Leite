import type { IncomingMessage, ServerResponse } from 'node:http';
import { getUserForSession, parseCookie, SESSION_COOKIE_NAME, type AuthedUser, type Role } from './auth.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'JSON inválido no corpo da requisição.');
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function getAuthedUser(req: IncomingMessage): Promise<AuthedUser | null> {
  const token = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  return getUserForSession(token);
}

/** Throws 401 if not logged in. Every mutating endpoint calls this before doing anything. */
export async function requireAuth(req: IncomingMessage): Promise<AuthedUser> {
  const user = await getAuthedUser(req);
  if (!user) throw new HttpError(401, 'Não autenticado.');
  return user;
}

/** Throws 403 if the authenticated user doesn't have the given role. Validated
 *  here — server-side — never inferred from what buttons the client chose to show. */
export function requireRole(user: AuthedUser, role: Role): void {
  if (user.role !== role) throw new HttpError(403, 'Ação não permitida para o seu perfil de acesso.');
}

/** Wraps a handler so thrown HttpErrors (and unexpected errors) always produce a JSON response. */
export function withErrorHandling(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
      } else {
        console.error(err);
        sendJson(res, 500, { error: 'Erro interno.' });
      }
    }
  };
}
