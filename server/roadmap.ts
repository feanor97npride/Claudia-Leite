import { pool } from './db';
import { computeTotalWeeks, formatObjetivoPeriodLabel } from './dateUtils';
import { recordAudit } from './audit';
import { HttpError, requireRole } from './http';
import type { AuthedUser } from './auth';
import { DEFAULT_OBJETIVOS, SEED_ATIVIDADES } from '../src/lib/roadmapSeed';

export interface ObjetivoRow {
  id: string;
  name: string;
  entregaLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  totalWeeks: number;
}

export interface AtividadeRow {
  id: string;
  objetivoId: string;
  name: string;
  status: 'planned' | 'in_progress' | 'done';
  kind: 'planned' | 'extra';
  note: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  completedAt: string | null;
  raciAccountableName: string | null;
  raciResponsibleName: string | null;
}

function mapObjetivo(r: {
  id: string;
  name: string;
  entrega_label: string;
  period_start: string;
  period_end: string;
  period_label: string;
  total_weeks: number;
}): ObjetivoRow {
  return {
    id: r.id,
    name: r.name,
    entregaLabel: r.entrega_label,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    periodLabel: r.period_label,
    totalWeeks: r.total_weeks,
  };
}

function mapAtividade(r: {
  id: string;
  objetivo_id: string;
  name: string;
  status: 'planned' | 'in_progress' | 'done';
  kind: 'planned' | 'extra';
  note: string | null;
  planned_start: string | null;
  planned_end: string | null;
  completed_at: string | null;
  raci_accountable_name: string | null;
  raci_responsible_name: string | null;
}): AtividadeRow {
  return {
    id: r.id,
    objetivoId: r.objetivo_id,
    name: r.name,
    status: r.status,
    kind: r.kind,
    note: r.note,
    plannedStart: r.planned_start,
    plannedEnd: r.planned_end,
    completedAt: r.completed_at,
    raciAccountableName: r.raci_accountable_name,
    raciResponsibleName: r.raci_responsible_name,
  };
}

/** Idempotent: seeds the 4 fixed objetivos + their planned activity catalog once, only if empty. */
export async function seedRoadmapIfNeeded(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM objetivos');
  if (Number(rows[0].count) > 0) return;

  for (const obj of DEFAULT_OBJETIVOS) {
    await pool.query(
      `INSERT INTO objetivos (id, name, entrega_label, period_start, period_end, period_label, total_weeks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [obj.id, obj.name, obj.entregaLabel, obj.periodStart, obj.periodEnd, obj.periodLabel, obj.totalWeeks],
    );
    for (const name of SEED_ATIVIDADES[obj.id]) {
      await pool.query(
        `INSERT INTO atividades (objetivo_id, name, status, kind) VALUES ($1, $2, 'planned', 'planned')`,
        [obj.id, name],
      );
    }
  }
}

export async function listObjetivos(): Promise<ObjetivoRow[]> {
  const { rows } = await pool.query('SELECT * FROM objetivos ORDER BY created_at ASC');
  return rows.map(mapObjetivo);
}

export async function listAtividades(): Promise<AtividadeRow[]> {
  const { rows } = await pool.query('SELECT * FROM atividades ORDER BY created_at ASC');
  return rows.map(mapAtividade);
}

/**
 * Admin-only. Updates an objetivo's editable display fields and/or date
 * range. Every changed field is logged to audit_log (Bloco 1.1). When the
 * date range changes, the PREVIOUS range is preserved in objetivo_versions
 * before being overwritten (Bloco 1.5) rather than silently lost.
 */
export async function updateObjetivo(
  user: AuthedUser,
  id: string,
  patch: { name?: string; entregaLabel?: string; periodStart?: string; periodEnd?: string },
): Promise<ObjetivoRow> {
  requireRole(user, 'admin');

  const { rows } = await pool.query('SELECT * FROM objetivos WHERE id = $1', [id]);
  const current = rows[0] ? mapObjetivo(rows[0]) : null;
  if (!current) throw new HttpError(404, 'Objetivo não encontrado.');

  const name = patch.name?.trim() ?? current.name;
  const entregaLabel = patch.entregaLabel?.trim() ?? current.entregaLabel;
  const periodStart = patch.periodStart ?? current.periodStart;
  const periodEnd = patch.periodEnd ?? current.periodEnd;

  if (!name) throw new HttpError(400, 'O nome do objetivo não pode ficar vazio.');
  if (!entregaLabel) throw new HttpError(400, 'O rótulo da entrega não pode ficar vazio.');
  if (!(periodStart < periodEnd)) throw new HttpError(400, 'A data de início deve ser anterior à data de fim.');

  const datesChanged = periodStart !== current.periodStart || periodEnd !== current.periodEnd;
  const totalWeeks = datesChanged ? computeTotalWeeks(periodStart, periodEnd) : current.totalWeeks;
  const periodLabel = datesChanged ? formatObjetivoPeriodLabel(periodStart, periodEnd) : current.periodLabel;

  if (datesChanged) {
    await pool.query(
      `INSERT INTO objetivo_versions (objetivo_id, period_start, period_end, period_label, total_weeks, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, current.periodStart, current.periodEnd, current.periodLabel, current.totalWeeks, user.id],
    );
  }

  await pool.query(
    `UPDATE objetivos SET name = $1, entrega_label = $2, period_start = $3, period_end = $4,
       period_label = $5, total_weeks = $6, updated_at = now() WHERE id = $7`,
    [name, entregaLabel, periodStart, periodEnd, periodLabel, totalWeeks, id],
  );

  for (const [field, oldVal, newVal] of [
    ['name', current.name, name],
    ['entregaLabel', current.entregaLabel, entregaLabel],
    ['periodStart', current.periodStart, periodStart],
    ['periodEnd', current.periodEnd, periodEnd],
  ] as const) {
    if (oldVal !== newVal) {
      await recordAudit({ entityType: 'objetivo', entityId: id, field, oldValue: oldVal, newValue: newVal, user });
    }
  }

  return { id, name, entregaLabel, periodStart, periodEnd, periodLabel, totalWeeks };
}

export async function listObjetivoVersions(id: string) {
  const { rows } = await pool.query(
    'SELECT * FROM objetivo_versions WHERE objetivo_id = $1 ORDER BY superseded_at DESC',
    [id],
  );
  return rows;
}

export async function createExtraAtividade(user: AuthedUser, objetivoId: string, name: string): Promise<AtividadeRow> {
  requireRole(user, 'admin');
  const { rows: objRows } = await pool.query('SELECT id FROM objetivos WHERE id = $1', [objetivoId]);
  if (!objRows[0]) throw new HttpError(404, 'Objetivo não encontrado.');

  const { rows } = await pool.query(
    `INSERT INTO atividades (objetivo_id, name, status, kind) VALUES ($1, $2, 'planned', 'extra') RETURNING *`,
    [objetivoId, name],
  );
  const created = mapAtividade(rows[0]);
  await recordAudit({
    entityType: 'atividade',
    entityId: created.id,
    field: 'name',
    oldValue: null,
    newValue: created.name,
    user,
  });
  return created;
}

export async function deleteExtraAtividade(user: AuthedUser, id: string): Promise<void> {
  requireRole(user, 'admin');
  const { rows } = await pool.query('SELECT * FROM atividades WHERE id = $1', [id]);
  const current = rows[0] ? mapAtividade(rows[0]) : null;
  if (!current) throw new HttpError(404, 'Atividade não encontrada.');
  if (current.kind !== 'extra') throw new HttpError(400, 'Somente atividades extras podem ser removidas.');
  await pool.query('DELETE FROM atividades WHERE id = $1', [id]);
}

/**
 * Admin-only. Updates any subset of an atividade's editable fields in one
 * call (Bloco 2.5: save everything at once, not field by field). Every
 * changed field is logged (Bloco 1.1). Bloco 1.2: replanning a planned date
 * that was already set (not being defined for the first time) requires a
 * non-empty `reason`.
 */
export async function updateAtividade(
  user: AuthedUser,
  id: string,
  patch: {
    name?: string;
    note?: string | null;
    status?: 'planned' | 'in_progress' | 'done';
    completedAt?: string | null;
    plannedStart?: string | null;
    plannedEnd?: string | null;
    raciAccountableName?: string | null;
    raciResponsibleName?: string | null;
    reason?: string;
  },
): Promise<AtividadeRow> {
  requireRole(user, 'admin');

  const { rows } = await pool.query('SELECT * FROM atividades WHERE id = $1', [id]);
  const current = rows[0] ? mapAtividade(rows[0]) : null;
  if (!current) throw new HttpError(404, 'Atividade não encontrada.');

  const next: AtividadeRow = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    note: patch.note !== undefined ? patch.note : current.note,
    status: patch.status !== undefined ? patch.status : current.status,
    completedAt: patch.completedAt !== undefined ? patch.completedAt : current.completedAt,
    plannedStart: patch.plannedStart !== undefined ? patch.plannedStart : current.plannedStart,
    plannedEnd: patch.plannedEnd !== undefined ? patch.plannedEnd : current.plannedEnd,
    raciAccountableName: patch.raciAccountableName !== undefined ? patch.raciAccountableName : current.raciAccountableName,
    raciResponsibleName: patch.raciResponsibleName !== undefined ? patch.raciResponsibleName : current.raciResponsibleName,
  };

  if (!next.name) throw new HttpError(400, 'O nome da atividade não pode ficar vazio.');
  if (next.plannedStart && next.plannedEnd && !(next.plannedStart < next.plannedEnd)) {
    throw new HttpError(400, 'A data de início planejada deve ser anterior à data de fim planejada.');
  }

  // Replanning: a planned date is being changed, not defined for the first time.
  const replanningStart = patch.plannedStart !== undefined && current.plannedStart && patch.plannedStart !== current.plannedStart;
  const replanningEnd = patch.plannedEnd !== undefined && current.plannedEnd && patch.plannedEnd !== current.plannedEnd;
  if ((replanningStart || replanningEnd) && !patch.reason?.trim()) {
    throw new HttpError(400, 'Motivo da mudança é obrigatório ao replanejar uma data já definida.');
  }

  // Auto-fill real completion date when transitioning to 'done' (Bloco 2.5),
  // still manually adjustable via patch.completedAt in the same call.
  if (patch.status === 'done' && patch.completedAt === undefined && !current.completedAt) {
    next.completedAt = new Date().toISOString().slice(0, 10);
  }
  if (patch.status !== undefined && patch.status !== 'done' && patch.completedAt === undefined) {
    next.completedAt = null;
  }

  await pool.query(
    `UPDATE atividades SET name = $1, note = $2, status = $3, completed_at = $4, planned_start = $5,
       planned_end = $6, raci_accountable_name = $7, raci_responsible_name = $8, updated_at = now()
     WHERE id = $9`,
    [
      next.name,
      next.note,
      next.status,
      next.completedAt,
      next.plannedStart,
      next.plannedEnd,
      next.raciAccountableName,
      next.raciResponsibleName,
      id,
    ],
  );

  const fieldPairs: [string, string | null, string | null][] = [
    ['name', current.name, next.name],
    ['note', current.note, next.note],
    ['status', current.status, next.status],
    ['completedAt', current.completedAt, next.completedAt],
    ['plannedStart', current.plannedStart, next.plannedStart],
    ['plannedEnd', current.plannedEnd, next.plannedEnd],
    ['raciAccountableName', current.raciAccountableName, next.raciAccountableName],
    ['raciResponsibleName', current.raciResponsibleName, next.raciResponsibleName],
  ];
  for (const [field, oldVal, newVal] of fieldPairs) {
    if (oldVal !== newVal) {
      const reason = field === 'plannedStart' || field === 'plannedEnd' ? (patch.reason ?? null) : null;
      await recordAudit({ entityType: 'atividade', entityId: id, field, oldValue: oldVal, newValue: newVal, reason, user });
    }
  }

  return next;
}
