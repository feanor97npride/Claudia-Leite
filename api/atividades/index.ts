import type { IncomingMessage, ServerResponse } from 'node:http';
import { listAtividades, createExtraAtividade } from '../../server/roadmap';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http';

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
    const created = await createExtraAtividade(user, objetivoId, name);
    sendJson(res, 201, { atividade: created });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
