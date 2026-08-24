import type { Atividade, ActivityKind, Objetivo, ObjetivoId, RoadmapSnapshot } from '../types';
import { currentWeekOfObjetivo, isWithinWeek } from '../utils/date';

// Objetivo/Atividade are now server-authoritative (see /api/objetivos,
// /api/atividades and server/roadmap.ts) — seeding happens once on the
// backend the first time they're requested. This module keeps only the
// pure, presentation-side calculations shared by the editor and snapshot.

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

export interface GovernanceIndicators {
  onTimePercent: number | null;
  earlyPercent: number | null;
  latePercent: number | null;
  withDataCount: number;
  extraActivitiesCount: number;
  averageAheadBehind: number | null;
}

/**
 * Bloco 1.4: indicadores de governança agregados de TODO o roadmap (todos os
 * objetivos juntos), reaproveitando o mesmo cálculo de adiantamento/atraso
 * usado por objetivo. % são sobre as atividades planejadas concluídas que
 * têm dados de prazo suficientes — as demais (sem prazo, ou não concluídas)
 * simplesmente não entram, em vez de contar como 0%.
 */
export function computeGovernanceIndicators(atividades: Atividade[]): GovernanceIndicators {
  const values = atividades
    .filter((a) => a.kind === 'planned')
    .map(computeAheadBehindPercent)
    .filter((v): v is number => v !== null);
  const withDataCount = values.length;
  const pct = (count: number) => (withDataCount === 0 ? null : Math.round((count / withDataCount) * 100));
  return {
    onTimePercent: pct(values.filter((v) => v === 0).length),
    earlyPercent: pct(values.filter((v) => v > 0).length),
    latePercent: pct(values.filter((v) => v < 0).length),
    withDataCount,
    extraActivitiesCount: atividades.filter((a) => a.kind === 'extra').length,
    averageAheadBehind: withDataCount === 0 ? null : Math.round(values.reduce((sum, v) => sum + v, 0) / withDataCount),
  };
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
