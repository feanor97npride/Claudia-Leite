import type { Atividade, AtividadePatch, AuditEntry, AuthedUser, Objetivo, ObjetivoId, ObjetivoVersion } from '../types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? 'Erro inesperado.');
  return body as T;
}

// --- Auth ---
export async function getMe(): Promise<AuthedUser | null> {
  const { user } = await request<{ user: AuthedUser | null }>('/api/auth/me');
  return user;
}

export async function loginRequest(email: string, password: string): Promise<AuthedUser> {
  const { user } = await request<{ user: AuthedUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return user;
}

export function logoutRequest(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function changePasswordRequest(currentPassword: string, newPassword: string): Promise<void> {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// --- Roadmap (Objetivo/Atividade) ---
export async function fetchObjetivos(): Promise<Objetivo[]> {
  const { objetivos } = await request<{ objetivos: Objetivo[] }>('/api/objetivos');
  return objetivos;
}

export async function fetchAtividades(): Promise<Atividade[]> {
  const { atividades } = await request<{ atividades: Atividade[] }>('/api/atividades');
  return atividades;
}

export async function updateObjetivoApi(id: ObjetivoId, patch: Partial<Objetivo>): Promise<Objetivo> {
  const { objetivo } = await request<{ objetivo: Objetivo }>(`/api/objetivos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return objetivo;
}

export async function fetchObjetivoVersions(id: ObjetivoId): Promise<ObjetivoVersion[]> {
  const { versions } = await request<{ versions: ObjetivoVersion[] }>(`/api/objetivos/${id}/versions`);
  return versions;
}

export async function updateAtividadeApi(id: string, patch: AtividadePatch): Promise<Atividade> {
  const { atividade } = await request<{ atividade: Atividade }>(`/api/atividades/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return atividade;
}

export async function createExtraAtividadeApi(objetivoId: ObjetivoId, name: string): Promise<Atividade> {
  const { atividade } = await request<{ atividade: Atividade }>('/api/atividades', {
    method: 'POST',
    body: JSON.stringify({ objetivoId, name }),
  });
  return atividade;
}

export function deleteExtraAtividadeApi(id: string): Promise<void> {
  return request(`/api/atividades/${id}`, { method: 'DELETE' });
}

export async function fetchAuditLog(
  entityType: 'objetivo' | 'atividade',
  entityId: string,
): Promise<{ entries: AuditEntry[]; replanCount: number }> {
  return request(`/api/audit-log?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`);
}

const OBJETIVO_IDS: ObjetivoId[] = ['diagnostico', 'governanca', 'operacao', 'estrategia_futura'];

/** Bloco 1.4: replan count is aggregated per-objetivo server-side (server/audit.ts
 *  countReplansForObjetivo already includes that objetivo's atividades), so summing
 *  across the 4 fixed objetivos gives the roadmap-wide total with no double counting. */
export async function fetchTotalReplanCount(): Promise<number> {
  const results = await Promise.all(OBJETIVO_IDS.map((id) => fetchAuditLog('objetivo', id)));
  return results.reduce((sum, r) => sum + r.replanCount, 0);
}
