import { pool } from './db.js';
import { HttpError } from './http.js';
import type { AuthedUser } from './auth.js';
import type { Indicator, Project, Report, RoadmapSnapshot } from '../src/types.js';

interface ReportData {
  periodLabel: string;
  area: string;
  responsible: string;
  execSummary: string;
  projects: Project[];
  indicators: Indicator[];
  highlights: string;
  attentionPoints: string;
  nextSteps: string;
  roadmapSnapshot?: RoadmapSnapshot;
}

export interface ReportPatch {
  weekStart: string;
  periodLabel: string;
  area: string;
  responsible: string;
  execSummary: string;
  projects: Project[];
  indicators: Indicator[];
  highlights: string;
  attentionPoints: string;
  nextSteps: string;
  roadmapSnapshot?: RoadmapSnapshot;
}

function mapRow(row: {
  id: string;
  user_id: string;
  week_start: string;
  data: ReportData;
  created_at: string;
  updated_at: string;
}): Report {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    periodLabel: row.data.periodLabel,
    area: row.data.area,
    responsible: row.data.responsible,
    execSummary: row.data.execSummary,
    projects: row.data.projects,
    indicators: row.data.indicators,
    highlights: row.data.highlights,
    attentionPoints: row.data.attentionPoints,
    nextSteps: row.data.nextSteps,
    roadmapSnapshot: row.data.roadmapSnapshot,
  };
}

/** Every user's report history is private to them — never shared or
 *  admin-visible, same as when it lived in their own browser's localStorage. */
export async function listReports(user: AuthedUser): Promise<Report[]> {
  const { rows } = await pool.query(
    'SELECT * FROM reports WHERE user_id = $1 ORDER BY week_start DESC',
    [user.id],
  );
  return rows.map(mapRow);
}

/** Create-or-update by id, matching the client's previous localStorage
 *  upsert semantics (Report.id is client-generated). Always scoped to the
 *  caller's own user_id — the client-sent userId field is never trusted. */
export async function upsertReport(user: AuthedUser, id: string, patch: ReportPatch): Promise<Report> {
  if (!patch.weekStart) throw new HttpError(400, 'weekStart é obrigatório.');

  const data: ReportData = {
    periodLabel: patch.periodLabel,
    area: patch.area,
    responsible: patch.responsible,
    execSummary: patch.execSummary,
    projects: patch.projects,
    indicators: patch.indicators,
    highlights: patch.highlights,
    attentionPoints: patch.attentionPoints,
    nextSteps: patch.nextSteps,
    roadmapSnapshot: patch.roadmapSnapshot,
  };

  const { rows } = await pool.query(
    `INSERT INTO reports (id, user_id, week_start, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       week_start = EXCLUDED.week_start,
       data = EXCLUDED.data,
       updated_at = now()
     WHERE reports.user_id = $2
     RETURNING *`,
    [id, user.id, patch.weekStart, JSON.stringify(data)],
  );
  if (!rows[0]) throw new HttpError(404, 'Relatório não encontrado.');
  return mapRow(rows[0]);
}

export async function deleteReport(user: AuthedUser, id: string): Promise<void> {
  const { rowCount } = await pool.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (rowCount === 0) throw new HttpError(404, 'Relatório não encontrado.');
}
