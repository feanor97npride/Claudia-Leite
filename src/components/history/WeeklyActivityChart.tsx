import type { WeeklyCompletedCount } from '../../lib/roadmap';
import { formatShortDate } from '../../utils/date';

// Single-series bar chart — no legend needed (see dataviz skill: "a single
// series needs no legend box", the heading below already names the metric).
const BAR_COLOR = '#3b6fd6'; // same BLUE_ACCENT as the Snapshot header
const EMPTY_BAR_COLOR = '#e4e8f2'; // same LINE token as the Snapshot page
const PLOT_HEIGHT = 72; // px reserved for bars, excluding the value label row above

interface Props {
  data: WeeklyCompletedCount[];
  totalCount: number;
}

/**
 * "Últimas 6 semanas" bar chart for the Snapshot sidebar (compliance/volume
 * framing) — how many atividades (any kind) were marked done per week,
 * oldest to newest. Deliberately plain HTML/CSS bars (mark specs: <=24px
 * thick, 4px rounded data-end, square baseline) rather than a charting
 * library, consistent with the rest of the app.
 */
export default function WeeklyActivityChart({ data, totalCount }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold text-slate-500 mb-2">Atividades concluídas — últimas 6 semanas</p>
      <div className="flex items-end gap-2" style={{ height: PLOT_HEIGHT }}>
        {data.map((d) => {
          const barHeight = Math.max(Math.round((d.count / max) * (PLOT_HEIGHT - 16)), d.count > 0 ? 3 : 1);
          return (
            <div
              key={d.weekStart}
              className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1"
              title={`Semana de ${formatShortDate(d.weekStart)}: ${d.count} ${d.count === 1 ? 'concluída' : 'concluídas'}`}
            >
              <span className="text-[9px] font-bold leading-none text-slate-500">{d.count}</span>
              <div
                className="w-full rounded-t-[4px]"
                style={{ height: barHeight, backgroundColor: d.count > 0 ? BAR_COLOR : EMPTY_BAR_COLOR }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-200">
        {data.map((d) => (
          <span key={d.weekStart} className="flex-1 min-w-0 text-center text-[9px] text-slate-400 truncate">
            {formatShortDate(d.weekStart).slice(0, 5)}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
        <span className="text-sm font-extrabold text-slate-900">{totalCount}</span> concluídas no período exibido
      </p>
    </div>
  );
}
