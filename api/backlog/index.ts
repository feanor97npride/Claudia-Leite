import type { IncomingMessage, ServerResponse } from 'node:http';
import { listBacklogItems, createBacklogItem } from '../../server/backlog.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);

  if (req.method === 'GET') {
    const items = await listBacklogItems();
    sendJson(res, 200, { items });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const created = await createBacklogItem(user, {
      name: String(body.name ?? ''),
      objetivoId: body.objetivoId as string | null | undefined,
      priority: body.priority as 'alta' | 'media' | 'baixa' | undefined,
      status: body.status as 'nao_iniciado' | 'em_andamento' | 'concluido' | undefined,
      estimatedDueDate: body.estimatedDueDate as string | null | undefined,
    });
    sendJson(res, 201, { item: created });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
