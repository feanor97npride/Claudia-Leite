import type { Atividade, ActivityKind, Objetivo, ObjetivoId, RoadmapSnapshot } from '../types';
import { newId, getAtividades, saveAtividades, getObjetivos, saveObjetivos } from './storage';
import { DEFAULT_OBJETIVOS, SEED_ATIVIDADES } from './roadmapSeed';
import { currentWeekOfObjetivo, isWithinWeek } from '../utils/date';

export function blankAtividade(objetivoId: ObjetivoId, kind: ActivityKind = 'extra', name = ''): Atividade {
  return { id: newId(), name, objetivoId, status: 'planned', kind };
}

/** Idempotent: seeds the fixed planned-activity catalog once per user, on first load only. */
export function seedAtividadesIfNeeded(userId: string): Atividade[] {
  const existing = getAtividades(userId);
  if (existing.length > 0) return existing;
  const seeded = DEFAULT_OBJETIVOS.flatMap((obj) =>
    SEED_ATIVIDADES[obj.id].map((name) => ({
      id: newId(),
      name,
      objetivoId: obj.id,
      status: 'planned' as const,
      kind: 'planned' as const,
    })),
  );
  saveAtividades(userId, seeded);
  return seeded;
}

/** Idempotent: seeds the editable objetivo catalog once per user, on first load only. */
export function seedObjetivosIfNeeded(userId: string): Objetivo[] {
  const existing = getObjetivos(userId);
  if (existing.length > 0) return existing;
  saveObjetivos(userId, DEFAULT_OBJETIVOS);
  return DEFAULT_OBJETIVOS;
}

export function atividadesForObjetivo(objetivoId: ObjetivoId, atividades: Atividade[]): Atividade[] {
  return atividades.filter((a) => a.objetivoId === objetivoId);
}

/** progress% = done planned / total planned, per objetivo. Extras never count. */
export function computeObjetivoProgress(objetivoId: ObjetivoId, atividades: Atividade[]): number {
  const planned = atividades.filter((a) => a.objetivoId === objetivoId && a.kind === 'planned');
  if (planned.length === 0) return 0;
  const done = planned.filter((a) => a.status === 'done').length;
  return Math.round((done / planned.length) * 100);
}

function completedInWeek(objetivoId: ObjetivoId, atividades: Atividade[], weekStart: string, kind: ActivityKind) {
  return atividades
    .filter(
      (a) =>
        a.objetivoId === objetivoId &&
        a.kind === kind &&
        a.status === 'done' &&
        a.completedAt &&
        isWithinWeek(a.completedAt, weekStart),
    )
    .map((a) => ({ id: a.id, name: a.name }));
}

/** Builds the frozen roadmap snapshot for a report, anchored to that report's own week. */
export function buildRoadmapSnapshot(atividades: Atividade[], weekStart: string, objetivos: Objetivo[]): RoadmapSnapshot {
  const referenceDate = new Date(weekStart + 'T00:00:00');
  return objetivos.map((obj) => ({
    objetivoId: obj.id,
    name: obj.name,
    entregaLabel: obj.entregaLabel,
    periodLabel: obj.periodLabel,
    totalWeeks: obj.totalWeeks,
    progress: computeObjetivoProgress(obj.id, atividades),
    weekOfQuarter: currentWeekOfObjetivo(obj, referenceDate),
    completedPlanned: completedInWeek(obj.id, atividades, weekStart, 'planned'),
    completedExtra: completedInWeek(obj.id, atividades, weekStart, 'extra'),
  }));
}
