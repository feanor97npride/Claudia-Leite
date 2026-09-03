import { pool } from './db.js';
import { HttpError, requireRole } from './http.js';
import type { AuthedUser } from './auth.js';

export interface BacklogItemRow {
  id: string;
  name: string;
  objetivoId: string | null;
  priority: 'alta' | 'media' | 'baixa';
  status: 'nao_iniciado' | 'em_andamento' | 'concluido';
  estimatedDueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapBacklogItem(r: {
  id: string;
  name: string;
  objetivo_id: string | null;
  priority: 'alta' | 'media' | 'baixa';
  status: 'nao_iniciado' | 'em_andamento' | 'concluido';
  estimated_due_date: string | null;
  created_at: string;
  updated_at: string;
}): BacklogItemRow {
  return {
    id: r.id,
    name: r.name,
    objetivoId: r.objetivo_id,
    priority: r.priority,
    status: r.status,
    estimatedDueDate: r.estimated_due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listBacklogItems(): Promise<BacklogItemRow[]> {
  const { rows } = await pool.query('SELECT * FROM backlog_items ORDER BY created_at ASC');
  return rows.map(mapBacklogItem);
}

export async function createBacklogItem(
  user: AuthedUser,
  patch: {
    name: string;
    objetivoId?: string | null;
    priority?: 'alta' | 'media' | 'baixa';
    status?: 'nao_iniciado' | 'em_andamento' | 'concluido';
    estimatedDueDate?: string | null;
  },
): Promise<BacklogItemRow> {
  requireRole(user, 'admin');
  const name = patch.name.trim();
  if (!name) throw new HttpError(400, 'O nome do item de backlog não pode ficar vazio.');

  if (patch.objetivoId) {
    const { rows: objRows } = await pool.query('SELECT id FROM objetivos WHERE id = $1', [patch.objetivoId]);
    if (!objRows[0]) throw new HttpError(404, 'Objetivo não encontrado.');
  }

  const { rows } = await pool.query(
    `INSERT INTO backlog_items (name, objetivo_id, priority, status, estimated_due_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, patch.objetivoId ?? null, patch.priority ?? 'media', patch.status ?? 'nao_iniciado', patch.estimatedDueDate ?? null],
  );
  return mapBacklogItem(rows[0]);
}

export async function updateBacklogItem(
  user: AuthedUser,
  id: string,
  patch: {
    name?: string;
    objetivoId?: string | null;
    priority?: 'alta' | 'media' | 'baixa';
    status?: 'nao_iniciado' | 'em_andamento' | 'concluido';
    estimatedDueDate?: string | null;
  },
): Promise<BacklogItemRow> {
  requireRole(user, 'admin');

  const { rows } = await pool.query('SELECT * FROM backlog_items WHERE id = $1', [id]);
  const current = rows[0] ? mapBacklogItem(rows[0]) : null;
  if (!current) throw new HttpError(404, 'Item de backlog não encontrado.');

  if (patch.objetivoId !== undefined && patch.objetivoId !== null) {
    const { rows: objRows } = await pool.query('SELECT id FROM objetivos WHERE id = $1', [patch.objetivoId]);
    if (!objRows[0]) throw new HttpError(404, 'Objetivo não encontrado.');
  }

  const next: BacklogItemRow = {
    ...current,
    name: patch.name !== undefined ? patch.name.trim() : current.name,
    objetivoId: patch.objetivoId !== undefined ? patch.objetivoId : current.objetivoId,
    priority: patch.priority !== undefined ? patch.priority : current.priority,
    status: patch.status !== undefined ? patch.status : current.status,
    estimatedDueDate: patch.estimatedDueDate !== undefined ? patch.estimatedDueDate : current.estimatedDueDate,
  };
  if (!next.name) throw new HttpError(400, 'O nome do item de backlog não pode ficar vazio.');

  await pool.query(
    `UPDATE backlog_items SET name = $1, objetivo_id = $2, priority = $3, status = $4,
       estimated_due_date = $5, updated_at = now() WHERE id = $6`,
    [next.name, next.objetivoId, next.priority, next.status, next.estimatedDueDate, id],
  );
  return next;
}

export async function deleteBacklogItem(user: AuthedUser, id: string): Promise<void> {
  requireRole(user, 'admin');
  const { rowCount } = await pool.query('DELETE FROM backlog_items WHERE id = $1', [id]);
  if (rowCount === 0) throw new HttpError(404, 'Item de backlog não encontrado.');
}
