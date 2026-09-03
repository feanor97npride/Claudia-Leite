import type { IncomingMessage, ServerResponse } from 'node:http';
import { listReports, upsertReport, deleteReport } from '../server/reports.js';
import { readJsonBody, sendJson, withErrorHandling, HttpError, requireAuth } from '../server/http.js';
import type { RoadmapSnapshot } from '../src/types.js';

// GET/POST/DELETE all merged into one file (DELETE takes ?id=... instead of
// a /:id segment) to keep this under Vercel's 12-Serverless-Function cap on
// the Hobby plan — see api/auth/[action].ts for the same reasoning.
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

  if (req.method === 'DELETE') {
    const url = new URL(req.url ?? '', 'http://internal');
    const id = url.searchParams.get('id') ?? '';
    if (!id) throw new HttpError(400, 'id é obrigatório.');
    await deleteReport(user, id);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(405, 'Método não permitido.');
});
