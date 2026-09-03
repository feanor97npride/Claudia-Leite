import type { IncomingMessage, ServerResponse } from 'node:http';
import { updateObjetivo } from '../../server/roadmap.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';

function idFromUrl(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1]);
}

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);
  if (req.method !== 'PATCH') throw new HttpError(405, 'Método não permitido.');

  const id = idFromUrl(req.url ?? '');
  const body = await readJsonBody(req);
  const updated = await updateObjetivo(user, id, {
    name: body.name as string | undefined,
    entregaLabel: body.entregaLabel as string | undefined,
    periodStart: body.periodStart as string | undefined,
    periodEnd: body.periodEnd as string | undefined,
  });
  sendJson(res, 200, { objetivo: updated });
});
