import type { Atividade, Tone } from '../../types';
import { TONE_META } from '../../types';
import { computeGovernanceIndicators } from '../../lib/roadmap';

interface Props {
  atividades: Atividade[];
}

function Tile({ value, label, tone }: { value: string; label: string; tone?: Tone }) {
  const color = tone ? TONE_META[tone].text : 'text-slate-900';
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
      <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1.5 leading-tight">{label}</p>
    </div>
  );
}

/** Bloco 1.4: PMO/ITIL-style rollup of the whole roadmap's health — % on-time/
 *  late/early, extra (out-of-plan) activity count, and the existing average
 *  ahead/behind %. */
export default function GovernanceIndicators({ atividades }: Props) {
  const g = computeGovernanceIndicators(atividades);
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Indicadores de Governança</h2>
      {g.withDataCount === 0 && (
        <p className="text-xs text-slate-400 italic mb-3">
          Ainda sem atividades planejadas concluídas com dados de prazo suficientes para calcular no
          prazo/adiantamento/atraso.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Tile value={pct(g.onTimePercent)} label="No prazo" />
        <Tile value={pct(g.earlyPercent)} label="Adiantadas" tone={g.earlyPercent ? 'good' : 'neutral'} />
        <Tile value={pct(g.latePercent)} label="Atrasadas" tone={g.latePercent ? 'bad' : 'neutral'} />
        <Tile value={String(g.extraActivitiesCount)} label="Atividades extras" />
        <Tile
          value={
            g.averageAheadBehind === null
              ? '—'
              : `${g.averageAheadBehind > 0 ? '+' : ''}${g.averageAheadBehind}%`
          }
          label="Adiantamento médio"
          tone={
            g.averageAheadBehind === null
              ? 'neutral'
              : g.averageAheadBehind > 0
                ? 'good'
                : g.averageAheadBehind < 0
                  ? 'bad'
                  : 'neutral'
          }
        />
      </div>
    </section>
  );
}
