interface Props {
  /** % of atividades that SHOULD already be done today — those whose
   *  plannedEnd has already passed (deadline-based, not a partial-progress
   *  estimate). Same denominator as realizadoPct below, so the two are
   *  directly comparable: more done than overdue means ahead of schedule. */
  planejadoPct: number;
  /** % actually done — concluídas/total, same number as the "Concluídas"
   *  stat card and the current "Progresso Geral" card. */
  realizadoPct: number;
}

const AGGREGATE = '#7c3aed';
const GOOD = '#15803d';

/**
 * Aggregate-level (whole roadmap, not per-Categoria) comparison of expected
 * vs. actual progress — a single track with a solid fill for "realizado"
 * and a dashed marker for where "planejado" should be today. Purely a
 * read-out of the same two numbers already computed for the KPI strip
 * above it; never touches individual atividade bars or Categoria headers.
 */
export default function PlanejadoRealizadoCard({ planejadoPct, realizadoPct }: Props) {
  const deltaPp = realizadoPct - planejadoPct;
  const onTrack = deltaPp >= 0;
  // Purple (the app's existing "aggregate roadmap" accent, already used by
  // the "Total de Atividades" card) while behind schedule; green once
  // caught up or ahead — the badge stays red/green regardless, since that's
  // the one element whose whole job is to flag the alert.
  const fillColor = onTrack ? GOOD : AGGREGATE;

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-4 mb-3 shrink-0">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3.5">
        <span className="text-xs font-semibold text-slate-600">Planejado vs. realizado — roadmap geral</span>
        <span
          className="text-[11px] font-bold rounded-full px-3 py-1 shrink-0 [font-variant-numeric:tabular-nums]"
          style={onTrack ? { backgroundColor: '#e9f7ee', color: GOOD } : { backgroundColor: '#fdeaea', color: '#b91c1c' }}
        >
          Planejado: {planejadoPct}% · Realizado: {realizadoPct}% · {deltaPp >= 0 ? '+' : '−'}
          {Math.abs(deltaPp)} p.p.
        </span>
      </div>

      <div className="relative pt-5">
        <span
          aria-hidden="true"
          className="absolute top-0 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap"
          style={{ left: `${Math.min(100, Math.max(0, planejadoPct))}%` }}
        >
          Planejado
        </span>
        <div className="relative h-[30px] rounded-lg bg-slate-100 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-l-lg flex items-center justify-end px-2 transition-[width] duration-300 ease-out"
            style={{ width: `${realizadoPct}%`, backgroundColor: fillColor }}
          >
            {realizadoPct >= 8 && (
              <span className="text-[11px] font-bold text-white [font-variant-numeric:tabular-nums]">{realizadoPct}%</span>
            )}
          </div>
          <div
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 z-10 border-l-2 border-dashed border-slate-900"
            style={{ left: `${Math.min(100, Math.max(0, planejadoPct))}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: fillColor }} />
          Realizado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-3.5 h-0 border-t-2 border-dashed border-slate-900 shrink-0" />
          Planejado até hoje
        </span>
      </div>
    </div>
  );
}
