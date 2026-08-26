import type {
  Atividade,
  AtividadePatch,
  AuditEntry,
  AuthedUser,
  Objetivo,
  ObjetivoId,
  ObjetivoVersion,
  Report,
} from '../types';

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

export async function createExtraAtividadeApi(
  objetivoId: ObjetivoId,
  name: string,
  weekStart: string,
  plannedStart?: string,
  plannedEnd?: string,
): Promise<Atividade> {
  const { atividade } = await request<{ atividade: Atividade }>('/api/atividades', {
    method: 'POST',
    body: JSON.stringify({ objetivoId, name, weekStart, plannedStart, plannedEnd }),
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

// --- Reports (weekly status report history) ---
export async function fetchReports(): Promise<Report[]> {
  const { reports } = await request<{ reports: Report[] }>('/api/reports');
  return reports;
}

/** Create-or-update by report.id — mirrors the previous localStorage upsert
 *  semantics (see src/lib/storage.ts, kept only as a one-time migration
 *  source now). userId/createdAt/updatedAt in the response come from the
 *  server, which is the source of truth for them. */
export async function upsertReportApi(report: Report): Promise<Report> {
  const { report: saved } = await request<{ report: Report }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
  return saved;
}

export function deleteReportApi(id: string): Promise<void> {
  return request(`/api/reports?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

