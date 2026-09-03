import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAuditLog, countReplans, countReplansForObjetivo, type EntityType } from '../server/audit.js';
import { sendJson, withErrorHandling, HttpError, requireAuth } from '../server/http.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  await requireAuth(req); // Bloco 1.1: visible to both Admin and Viewer, read-only
  if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');

  const url = new URL(req.url ?? '', 'http://localhost');
  const entityType = url.searchParams.get('entityType') as EntityType | null;
  const entityId = url.searchParams.get('entityId');
  if (entityType !== 'objetivo' && entityType !== 'atividade') {
    throw new HttpError(400, 'entityType deve ser "objetivo" ou "atividade".');
  }
  if (!entityId) throw new HttpError(400, 'entityId é obrigatório.');

  const [entries, replanCount] = await Promise.all([
    getAuditLog(entityType, entityId),
    entityType === 'objetivo' ? countReplansForObjetivo(entityId) : countReplans(entityType, entityId),
  ]);
  sendJson(res, 200, { entries, replanCount });
});
