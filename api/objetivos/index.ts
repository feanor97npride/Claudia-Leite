import type { IncomingMessage, ServerResponse } from 'node:http';
import { listObjetivos, seedRoadmapIfNeeded } from '../../server/roadmap';
import { sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  await requireAuth(req); // both Admin and Viewer can read
  if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');

  await seedRoadmapIfNeeded();
  const objetivos = await listObjetivos();
  sendJson(res, 200, { objetivos });
});
