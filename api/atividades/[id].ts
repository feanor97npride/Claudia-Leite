import type { IncomingMessage, ServerResponse } from 'node:http';
import { updateAtividade, deleteExtraAtividade } from '../../server/roadmap.js';
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
    const updated = await updateAtividade(user, id, {
      name: body.name as string | undefined,
      note: body.note as string | null | undefined,
      status: body.status as 'planned' | 'in_progress' | 'done' | undefined,
      completedAt: body.completedAt as string | null | undefined,
      plannedStart: body.plannedStart as string | null | undefined,
      plannedEnd: body.plannedEnd as string | null | undefined,
      raciAccountableName: body.raciAccountableName as string | null | undefined,
      raciResponsibleName: body.raciResponsibleName as string | null | undefined,
      objetivoId: body.objetivoId as string | undefined,
      reason: body.reason as string | undefined,
    });
    sendJson(res, 200, { atividade: updated });
    return;
  }

  if (req.method === 'DELETE') {
    await deleteExtraAtividade(user, id);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
