import type { IncomingMessage, ServerResponse } from 'node:http';
import { listObjetivoVersions } from '../../../server/roadmap';
import { sendJson, withErrorHandling, HttpError, requireAuth } from '../../../server/http';

function idFromUrl(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  // .../api/objetivos/<id>/versions
  return decodeURIComponent(parts[parts.length - 2]);
}

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  await requireAuth(req); // both Admin and Viewer can read version history
  if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');

  const id = idFromUrl(req.url ?? '');
  const versions = await listObjetivoVersions(id);
  sendJson(res, 200, { versions });
});
