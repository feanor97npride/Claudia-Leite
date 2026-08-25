import type { IncomingMessage, ServerResponse } from 'node:http';
import { listReports, upsertReport } from '../../server/reports.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../../server/http.js';
import type { RoadmapSnapshot } from '../../src/types.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  const user = await requireAuth(req);

  if (req.method === 'GET') {
    const reports = await listReports(user);
    sendJson(res, 200, { reports });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const id = String(body.id ?? '');
    if (!id) throw new HttpError(400, 'id é obrigatório.');
    const report = await upsertReport(user, id, {
      weekStart: String(body.weekStart ?? ''),
      periodLabel: String(body.periodLabel ?? ''),
      area: String(body.area ?? ''),
      responsible: String(body.responsible ?? ''),
      execSummary: String(body.execSummary ?? ''),
      projects: Array.isArray(body.projects) ? body.projects : [],
      indicators: Array.isArray(body.indicators) ? body.indicators : [],
      highlights: String(body.highlights ?? ''),
      attentionPoints: String(body.attentionPoints ?? ''),
      nextSteps: String(body.nextSteps ?? ''),
      roadmapSnapshot: body.roadmapSnapshot as RoadmapSnapshot | undefined,
    });
    sendJson(res, 201, { report });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
