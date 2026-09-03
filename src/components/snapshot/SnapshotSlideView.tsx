import { forwardRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { Atividade, Objetivo, Project, Report } from '../../types';
import { STATUS_META } from '../../types';
import { computeSnapshotHeroStats } from '../../lib/roadmap';
import StatusBadge from './StatusBadge';
import LogoOrigem from './LogoOrigem';
import { NAVY_900, NAVY_800, BLUE_ACCENT, LINE, PAGE_BG, INK_600, INK_400 } from './palette';
import { IconAlert, IconCheck, IconClock, IconLayers, IconSpark } from './icons';

interface Props {
  report: Report;
  /** Full history — only used to sum entregas/atividades across every week
   *  for the hero's accumulated figure (computeSnapshotHeroStats). */
  reports: Report[];
  atividades: Atividade[];
  objetivos: Objetivo[];
}

// Exact 16:9 — built for dropping straight into a slide deck (PowerPoint/
// Google Slides), unlike SnapshotView's tall one-pager. A FIXED height, not
// auto-growing: every row below has a set size (or the entregas grid caps
// how many cards it shows) so content never overflows the frame and gets
// silently clipped by the PNG export.
const FRAME_W = 1280;
const FRAME_H = 720;

// How many entregas fit legibly in the fixed-height grid before the rest
// collapse into a single "+N mais" tile — tuned to the 3-column layout.
const MAX_VISIBLE_ENTREGAS = 5;

function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

function StatPill({
  icon: Icon,
  color,
  tint,
  value,
  label,
}: {
  icon: (props: { className?: string; style?: CSSProperties }) => ReactElement;
  color: string;
  tint: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-white px-3 py-1.5 flex items-center gap-2" style={{ border: `1px solid ${LINE}` }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: tint }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-extrabold leading-none text-slate-900">{value}</p>
        <p className="text-[9px] font-medium leading-tight" style={{ color: INK_600 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function EntregaTile({ project }: { project: Project }) {
  const meta = STATUS_META[project.status];
  const detail = firstLine(project.deliveries);
  return (
    <div
      className="rounded-lg p-2.5 flex flex-col gap-1.5 min-h-0"
      style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${meta.color}` }}
    >
      <p className="text-[11px] font-bold leading-snug text-slate-900 line-clamp-2">{project.name || 'Projeto sem nome'}</p>
      <StatusBadge status={project.status} label={project.status === 'on_track' ? 'Concluído' : undefined} />
      {detail && (
        <p className="text-[10px] leading-snug line-clamp-2" style={{ color: INK_600 }}>
          {detail}
        </p>
      )}
    </div>
  );
}

/**
 * Condensed 16:9 "highlights slide" export — the same compliance/volume
 * hero figures as SnapshotView (via computeSnapshotHeroStats, so the two
 * views can never disagree on a number), boiled down to what fits on one
 * slide: header, hero, panorama + roadmap %, top entregas, and a 2-line
 * insights strip. Not a replacement for the full report — a companion
 * format for pasting into a presentation deck.
 */
const SnapshotSlideView = forwardRef<HTMLDivElement, Props>(({ report, reports, atividades, objetivos }, ref) => {
  const generatedAt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(report.updatedAt),
  );

  const { weekCompletedCount, totalCompletedCount, onTimeStreakWeeks, roadmapOverallProgress } = computeSnapshotHeroStats(
    report,
    reports,
    atividades,
    objetivos,
  );

  const statusCounts = report.projects.reduce(
    (acc, p) => ({ ...acc, [p.status]: acc[p.status] + 1 }),
    { on_track: 0, attention: 0, delayed: 0 } as Record<string, number>,
  );

  const visibleEntregas = report.projects.slice(0, MAX_VISIBLE_ENTREGAS);
  const overflowCount = report.projects.length - visibleEntregas.length;

  const highlight = firstLine(report.highlights);
  const attentionPoint = firstLine(report.attentionPoints);

  return (
    <div
      ref={ref}
      className="snapshot-slide rounded-2xl shadow-sm text-slate-900"
      style={{
        width: FRAME_W,
        height: FRAME_H,
        backgroundColor: PAGE_BG,
        border: `1px solid ${LINE}`,
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateRows: '72px 88px 52px 1fr 84px 20px',
        gap: 12,
        padding: 20,
        fontSize: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="rounded-xl px-5 flex items-center justify-between text-white"
        style={{ background: `linear-gradient(135deg, ${NAVY_900}, ${NAVY_800})` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${BLUE_ACCENT}, #5b8ff0)` }}
          >
            <IconLayers className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.12em] uppercase leading-none" style={{ color: '#9db4e8' }}>
              Status Report Semanal
            </p>
            <p className="text-base font-extrabold leading-tight truncate mt-0.5">{report.area || 'Sistemas (TI)'}</p>
          </div>
        </div>
        <div className="text-right shrink-0 pl-3">
          <p className="text-[9px] uppercase tracking-wider font-bold leading-none" style={{ color: '#9db4e8' }}>
            {report.periodLabel}
          </p>
          <p className="text-[11px] font-semibold mt-1" style={{ color: '#c3cde8' }}>
            Responsável: {report.responsible || '—'}
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-xl bg-white px-6 flex items-center gap-6" style={{ border: `1px solid ${LINE}` }}>
        <div>
          <p className="text-3xl font-extrabold leading-none text-slate-900">{weekCompletedCount}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: INK_600 }}>
            concluídas nesta semana
          </p>
        </div>
        <div className="w-px self-stretch my-2 shrink-0" style={{ backgroundColor: LINE }} />
        <div>
          <p className="text-3xl font-extrabold leading-none text-slate-900">{totalCompletedCount}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: INK_600 }}>
            desde o início do programa
          </p>
        </div>
        {onTimeStreakWeeks > 0 && (
          <div
            className="ml-auto flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 shrink-0"
            style={{ background: '#e9f7ee', border: '1px solid #bfe6cd' }}
          >
            <IconSpark className="w-3.5 h-3.5 shrink-0" style={{ color: '#137a3c' }} />
            <span className="text-[11px] font-extrabold leading-tight" style={{ color: '#137a3c' }}>
              {onTimeStreakWeeks} {onTimeStreakWeeks === 1 ? 'semana' : 'semanas'} 100% no prazo
            </span>
          </div>
        )}
      </div>

      {/* Panorama + Roadmap */}
      <div className="flex items-center gap-2.5">
        <StatPill icon={IconCheck} color={STATUS_META.on_track.color} tint="#e9f7ee" value={statusCounts.on_track} label="No prazo" />
        <StatPill icon={IconAlert} color={STATUS_META.attention.color} tint="#fef3e6" value={statusCounts.attention} label="Atenção" />
        <StatPill icon={IconClock} color={STATUS_META.delayed.color} tint="#fdeaea" value={statusCounts.delayed} label="Atrasados" />
        <div className="ml-auto rounded-lg bg-white px-3.5 py-1.5 flex items-center gap-2" style={{ border: `1px solid ${LINE}` }}>
          <span className="text-[10px] font-bold" style={{ color: NAVY_900 }}>
            Roadmap geral
          </span>
          <span className="text-sm font-extrabold" style={{ color: NAVY_900 }}>
            {roadmapOverallProgress}%
          </span>
        </div>
      </div>

      {/* Entregas da semana */}
      <div className="rounded-xl bg-white p-3.5 flex flex-col min-h-0" style={{ border: `1px solid ${LINE}` }}>
        <p className="text-[10px] font-extrabold uppercase tracking-wide mb-2 shrink-0" style={{ color: INK_400 }}>
          Entregas da semana
        </p>
        {report.projects.length === 0 ? (
          <p className="text-slate-400 italic text-[11px]">Nenhuma entrega registrada.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 flex-1 min-h-0">
            {visibleEntregas.map((p) => (
              <EntregaTile key={p.id} project={p} />
            ))}
            {overflowCount > 0 && (
              <div
                className="rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ border: `1px dashed ${LINE}`, color: INK_400 }}
              >
                +{overflowCount} mais
              </div>
            )}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="grid grid-cols-2 gap-2.5 min-h-0">
        <div className="rounded-lg p-2.5 flex flex-col min-h-0" style={{ background: '#e9f7ee', border: '1px solid #bfe6cd' }}>
          <p className="text-[9px] font-extrabold uppercase tracking-wide mb-1 shrink-0" style={{ color: '#137a3c' }}>
            Destaques
          </p>
          <p className="text-[10.5px] leading-snug line-clamp-2" style={{ color: '#1c3a28' }}>
            {highlight || '—'}
          </p>
        </div>
        <div className="rounded-lg p-2.5 flex flex-col min-h-0" style={{ background: '#fef3e6', border: '1px solid #f4d9ab' }}>
          <p className="text-[9px] font-extrabold uppercase tracking-wide mb-1 shrink-0" style={{ color: '#92400e' }}>
            Pontos de atenção
          </p>
          <p className="text-[10.5px] leading-snug line-clamp-2" style={{ color: '#78350f' }}>
            {attentionPoint || '—'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: INK_400 }}>
        <span>Gerado em {generatedAt}</span>
        <LogoOrigem className="text-xs" />
      </div>
    </div>
  );
});

SnapshotSlideView.displayName = 'SnapshotSlideView';

export default SnapshotSlideView;
