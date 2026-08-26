import type { IncomingMessage, ServerResponse } from 'node:http';
import { updateBacklogItem, deleteBacklogItem } from '../../server/backlog.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';

function idFromUrl(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1]);
}

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);
  const id = idFromUrl(req.url ?? '');

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const updated = await updateBacklogItem(user, id, {
      name: body.name as string | undefined,
      objetivoId: body.objetivoId as string | null | undefined,
      priority: body.priority as 'alta' | 'media' | 'baixa' | undefined,
      status: body.status as 'nao_iniciado' | 'em_andamento' | 'concluido' | undefined,
      estimatedDueDate: body.estimatedDueDate as string | null | undefined,
    });
    sendJson(res, 200, { item: updated });
    return;
  }

  if (req.method === 'DELETE') {
    await deleteBacklogItem(user, id);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
