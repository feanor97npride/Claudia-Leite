import { pool } from './db.js';
import type { AuthedUser } from './auth.js';

export type ChangeType = 'escopo' | 'prazo' | 'status' | 'outro';
export type EntityType = 'objetivo' | 'atividade';

export interface AuditEntry {
  id: number;
  entityType: EntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: ChangeType;
  reason: string | null;
  userId: string | null;
  actorLabel: string;
  createdAt: string;
}

// Bloco 1.2: classification is derived from which field changed — the
// client never chooses this, so the log stays trustworthy.
const FIELD_CHANGE_TYPE: Record<string, ChangeType> = {
  name: 'escopo',
  entregaLabel: 'escopo',
  note: 'escopo',
  objetivoId: 'escopo',
  raciAccountableName: 'outro',
  raciResponsibleName: 'outro',
  periodStart: 'prazo',
  periodEnd: 'prazo',
  plannedStart: 'prazo',
  plannedEnd: 'prazo',
  completedAt: 'prazo',
  status: 'status',
};

export function changeTypeForField(field: string): ChangeType {
  return FIELD_CHANGE_TYPE[field] ?? 'outro';
}

/** Every relevant edit (Bloco 1.1) logs one row per changed field. `user` is
 *  null only for genuinely unauthenticated/automated actions (e.g. a seed
 *  script) — recorded as "sistema automatizado", never left blank. */
export async function recordAudit(entry: {
  entityType: EntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string | null;
  user: AuthedUser | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, field, old_value, new_value, change_type, reason, user_id, actor_label)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.entityType,
      entry.entityId,
      entry.field,
      entry.oldValue,
      entry.newValue,
      changeTypeForField(entry.field),
      entry.reason ?? null,
      entry.user?.id ?? null,
      entry.user?.displayName ?? 'sistema automatizado',
    ],
  );
}

function mapRow(row: {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  change_type: ChangeType;
  reason: string | null;
  user_id: string | null;
  actor_label: string;
  created_at: string;
}): AuditEntry {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    changeType: row.change_type,
    reason: row.reason,
    userId: row.user_id,
    actorLabel: row.actor_label,
    createdAt: row.created_at,
  };
}

export async function getAuditLog(entityType: EntityType, entityId: string): Promise<AuditEntry[]> {
  const { rows } = await pool.query(
    'SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC',
    [entityType, entityId],
  );
  return rows.map(mapRow);
}

/**
 * Bloco 1.2: "Nº de replanejamentos" — count of prazo (date) changes that
 * replan an ALREADY-SET date (old_value IS NOT NULL). The very first time a
 * planned date is defined (old_value NULL) is initial planning, not a
 * replan, and must not inflate the "instabilidade de planejamento" signal.
 */
export async function countReplans(entityType: EntityType, entityId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM audit_log
     WHERE entity_type = $1 AND entity_id = $2 AND change_type = 'prazo' AND old_value IS NOT NULL`,
    [entityType, entityId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Same count, aggregated across every atividade that belongs to the given objetivo. */
export async function countReplansForObjetivo(objetivoId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM audit_log a
     WHERE a.change_type = 'prazo' AND a.old_value IS NOT NULL
       AND (
         (a.entity_type = 'objetivo' AND a.entity_id = $1)
         OR (a.entity_type = 'atividade' AND a.entity_id IN (SELECT id::text FROM atividades WHERE objetivo_id = $1))
       )`,
    [objetivoId],
  );
  return Number(rows[0]?.count ?? 0);
}
