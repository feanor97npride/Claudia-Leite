import type { IncomingMessage, ServerResponse } from 'node:http';
import { listAtividades, createExtraAtividade } from '../../server/roadmap.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);

  if (req.method === 'GET') {
    const atividades = await listAtividades();
    sendJson(res, 200, { atividades });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const objetivoId = String(body.objetivoId ?? '');
    const name = String(body.name ?? '');
    const weekStart = typeof body.weekStart === 'string' ? body.weekStart : null;
    const created = await createExtraAtividade(user, objetivoId, name, weekStart);
    sendJson(res, 201, { atividade: created });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
