import type { TimelineVisualStatus } from '../../types';
import { TIMELINE_STATUS_META } from '../../types';

interface Props {
  /** Visual status (already derived — done/in_progress/atrasado/planned) of
   *  every atividade currently visible in the Timeline, independent of the
   *  Categoria/Status/Responsável filter chips (a stats summary of "what's
   *  on the roadmap", not "what's currently shown"). Same length/order
   *  universe as `progressPercents` below — index i of one is the same
   *  atividade as index i of the other. */
  statuses: TimelineVisualStatus[];
  /** Each atividade's own progress % (computeBarFillPercent) — averaged for
   *  "Progresso Geral", which is the mean of every atividade's individual
   *  progress, NOT the fraction that's done (a done-but-just-started-late
   *  quarter and a done-on-day-one quarter both count as 100% done, but a
   *  roadmap that's 80% "in progress" everywhere isn't 0% done either). */
  progressPercents: number[];
}

function ProgressRing({ pct, size = 56, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E2E8F0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TIMELINE_STATUS_META.done.bg}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">{pct}%</span>
    </div>
  );
}

function StatCard({ colorBg, colorText, label, value, sub }: { colorBg: string; colorText: string; label: string; value: number; sub: string }) {
  return (
    <div className="shrink-0 w-[160px] sm:w-auto sm:flex-1 sm:min-w-[140px] bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm" style={{ backgroundColor: colorBg, color: colorText }}>
        {value}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 truncate">{label}</p>
        <p className="text-xs font-medium text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

/** Indicator row above the Timeline grid (mockup item 4) — progress ring +
 *  one stat card per visual status, computed from every atividade currently
 *  visible on the Timeline (RoadmapTimeline's `indicatorAtividades`) — does
 *  NOT require a planned start/end, unlike the atividades eligible to draw
 *  a bar in the grid below. */
export default function TimelineStatCards({ statuses, progressPercents }: Props) {
  const total = statuses.length;
  const count = (s: TimelineVisualStatus) => statuses.filter((v) => v === s).length;
  const pct = (n: number) => (total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`);
  const done = count('done');
  const inProgress = count('in_progress');
  const atrasado = count('atrasado');
  const planned = count('planned');
  const progressoGeral =
    progressPercents.length === 0
      ? 0
      : Math.round(progressPercents.reduce((sum, p) => sum + p, 0) / progressPercents.length);

  return (
    // Below `sm`, this scrolls horizontally as a compact chip strip instead
    // of wrapping into several tall rows — with 6 cards, wrapping ate most
    // of a phone's limited viewport height, squeezing the grid below it
    // down to almost nothing.
    <div className="flex gap-3 mb-3 shrink-0 overflow-x-auto sm:flex-wrap sm:overflow-visible">
      <div className="shrink-0 w-[210px] sm:w-auto sm:flex-1 sm:min-w-[190px] bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
        <ProgressRing pct={progressoGeral} />
        <div>
          <p className="text-[11px] text-slate-400">Progresso Geral</p>
          <p className="text-xs font-semibold text-slate-700">{progressoGeral}% do roadmap concluído</p>
        </div>
      </div>
      <StatCard colorBg={`${TIMELINE_STATUS_META.done.bg}1a`} colorText={TIMELINE_STATUS_META.done.bg} label="Concluídas" value={done} sub={pct(done)} />
      <StatCard
        colorBg={`${TIMELINE_STATUS_META.in_progress.bg}1a`}
        colorText={TIMELINE_STATUS_META.in_progress.bg}
        label="Em Andamento"
        value={inProgress}
        sub={pct(inProgress)}
      />
      <StatCard colorBg={`${TIMELINE_STATUS_META.atrasado.bg}1a`} colorText={TIMELINE_STATUS_META.atrasado.bg} label="Atrasadas" value={atrasado} sub={pct(atrasado)} />
      <StatCard colorBg="#f1f5f9" colorText="#64748b" label="Não Iniciadas" value={planned} sub={pct(planned)} />
      <StatCard colorBg="#ede9fe" colorText="#7c3aed" label="Total de Atividades" value={total} sub="100%" />
    </div>
  );
}
