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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * % de adiantamento/atraso de UMA atividade concluída.
 *
 *   duração planejada (dias) = plannedEnd - plannedStart
 *   dias de antecipação      = plannedEnd - completedAt   (positivo = concluída antes do prazo, negativo = depois)
 *   % adiantamento/atraso    = (dias de antecipação / duração planejada) * 100
 *
 * Exemplo: Matriz RACI planejada de 21/ago a 31/ago (10 dias), concluída em
 * 21/ago -> 10 dias de antecipação -> (10 / 10) * 100 = 100% de adiantamento.
 *
 * Retorna `null` (sem dados/não aplicável) quando a atividade não está
 * concluída, quando faltam plannedStart/plannedEnd/completedAt, ou quando a
 * duração planejada não é positiva — nesses casos a atividade simplesmente
 * não entra no cálculo, em vez de contar como 0%.
 */
export function computeAheadBehindPercent(a: Atividade): number | null {
  if (a.status !== 'done') return null;
  if (!a.plannedStart || !a.plannedEnd || !a.completedAt) return null;
  const plannedStart = new Date(a.plannedStart + 'T00:00:00').getTime();
  const plannedEnd = new Date(a.plannedEnd + 'T00:00:00').getTime();
  const completedAt = new Date(a.completedAt + 'T00:00:00').getTime();
  const plannedDurationDays = (plannedEnd - plannedStart) / DAY_MS;
  if (plannedDurationDays <= 0) return null;
  const daysAhead = (plannedEnd - completedAt) / DAY_MS;
  return Math.round((daysAhead / plannedDurationDays) * 100);
}

/**
 * Adiantamento médio do quarter: média simples do % de adiantamento/atraso
 * das atividades PLANEJADAS concluídas do objetivo (atividades extras nunca
 * entram, mesma regra já aplicada ao progresso %). `null` = ainda sem
 * nenhuma atividade planejada concluída com dados de prazo suficientes.
 */
export function computeObjetivoAheadBehind(objetivoId: ObjetivoId, atividades: Atividade[]): number | null {
  const values = atividades
    .filter((a) => a.objetivoId === objetivoId && a.kind === 'planned')
    .map(computeAheadBehindPercent)
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
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
