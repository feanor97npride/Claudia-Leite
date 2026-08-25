import type { IncomingMessage, ServerResponse } from 'node:http';
import { deleteReport } from '../../server/reports.js';
import { sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';

function idFromUrl(url: string): string {
  const parts = url.split('?')[0].split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1]);
}

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);
  const id = idFromUrl(req.url ?? '');

  if (req.method === 'DELETE') {
    await deleteReport(user, id);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
