import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { Project, Report } from '../../types';
import { STATUS_META } from '../../types';
import StatusBadge from './StatusBadge';
import LogoOrigem from './LogoOrigem';
import {
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFlag,
  IconGauge,
  IconLayers,
  IconSpark,
  IconTarget,
  IconTrendingUp,
  IconUsers,
} from './icons';

interface Props {
  report: Report;
}

// Fixed 16:9 export canvas. Content is measured and scaled to fit inside it
// so the exported snapshot is always this exact aspect ratio, regardless of
// how much content a given week's report has.
const FRAME_W = 1280;
const FRAME_H = 720;
const FOOTER_H = 30;
const CONTENT_H = FRAME_H - FOOTER_H;

// Section number badges (1-5) always use this single neutral color — the
// status palette (green/amber/red) is reserved exclusively for semaphore
// status, never for decoration.
const SECTION_COLOR = '#1e293b';

// Decorative accents for non-status elements (indicator icons, next-step
// numbering). Deliberately excludes green/amber/red so it never gets
// confused with the on-track/attention/delayed semaphore.
const DECOR = ['#0ea5b7', '#7c3aed', '#2563eb', '#0284c7', '#6366f1'];

const STATUS_ICONS = { check: IconCheck, alert: IconAlert, clock: IconClock };
const INDICATOR_ICONS = [IconGauge, IconTrendingUp, IconUsers, IconTarget, IconFlag];

function linesOf(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Bullet text should never render as shouting caps; leaves normal mixed-case input untouched. */
function normalizeCase(line: string): string {
  const isShouting = line === line.toUpperCase() && line !== line.toLowerCase();
  if (!isShouting) return line;
  return line.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function renderLines(text: string) {
  const lines = linesOf(text);
  if (lines.length === 0) return <p className="text-slate-400 italic">—</p>;
  return (
    <ul className="space-y-0.5 list-disc list-inside marker:text-current">
      {lines.map((line, i) => (
        <li key={i}>{normalizeCase(line)}</li>
      ))}
    </ul>
  );
}

/** Grid column count that grows with item count instead of leaving stretched empty columns. */
function gridColsFor(n: number, max = 4): string {
  const cols = Math.max(1, Math.min(max, n));
  return ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][cols - 1];
}

function SectionTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: SECTION_COLOR }}
      >
        {n}
      </span>
      <h2 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800">{children}</h2>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: (props: { className?: string; style?: CSSProperties }) => ReactElement;
  color: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 flex items-center gap-2 min-w-[108px]">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black leading-none" style={{ color }}>
          {value}
        </p>
        <p className="text-[8.5px] text-slate-500 leading-tight whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const meta = STATUS_META[project.status];
  const StatusIcon = STATUS_ICONS[meta.icon];
  const isComplete = project.percent >= 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-100">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: meta.color }}
        >
          <StatusIcon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-900 truncate">{project.name || 'Projeto sem nome'}</p>
          {!isComplete && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1 flex-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${project.percent}%`, backgroundColor: meta.color }} />
              </div>
              <span className="text-[8.5px] font-semibold text-slate-400 shrink-0">{project.percent}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-2.5 py-2 text-[10px] text-slate-600 leading-snug flex-1">{renderLines(project.deliveries)}</div>
      <div className="px-2.5 pb-2 flex items-center justify-between gap-1">
        <StatusBadge status={project.status} />
        {project.risks.trim() && (
          <span className="text-[8.5px] text-red-600 font-medium truncate max-w-[55%]" title={project.risks}>
            ⚠ {normalizeCase(project.risks.trim())}
          </span>
        )}
      </div>
    </div>
  );
}

const SnapshotView = forwardRef<HTMLDivElement, Props>(({ report }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      const naturalHeight = el.scrollHeight;
      if (naturalHeight === 0) return;
      const nextScale = Math.min(1, CONTENT_H / naturalHeight);
      setScale(nextScale);
      setOffset({
        x: (FRAME_W - FRAME_W * nextScale) / 2,
        y: (CONTENT_H - naturalHeight * nextScale) / 2,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [report]);

  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(report.updatedAt));

  const projectCols = gridColsFor(report.projects.length);

  const statusCounts = report.projects.reduce(
    (acc, p) => ({ ...acc, [p.status]: acc[p.status] + 1 }),
    { on_track: 0, attention: 0, delayed: 0 } as Record<string, number>,
  );

  const advances = report.projects
    .filter((p) => p.nextWeekAdvances.trim())
    .flatMap((p) => linesOf(p.nextWeekAdvances).map((line) => ({ project: p.name || 'Projeto', line })));
  const advanceCols = gridColsFor(advances.length, 3);

  const nextSteps = report.projects
    .filter((p) => p.nextSteps.trim())
    .flatMap((p) => linesOf(p.nextSteps).map((line) => ({ project: p.name || 'Projeto', line })));

  const highlightLines = linesOf(report.highlights);
  const attentionLines = linesOf(report.attentionPoints);
  const insightCount = (highlightLines.length > 0 ? 1 : 0) + (attentionLines.length > 0 ? 1 : 0);

  return (
    <div
      ref={ref}
      className="snapshot-frame bg-white mx-auto shadow-xl border border-slate-200 text-slate-800 relative overflow-hidden rounded-2xl"
      style={{ width: FRAME_W, height: FRAME_H }}
    >
      <div
        ref={contentRef}
        style={{
          width: FRAME_W,
          fontSize: '12px',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a1330] via-[#101f4d] to-[#16305c] text-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center shadow-lg shrink-0">
                <IconLayers className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[8.5px] font-bold tracking-[0.2em] text-sky-300 uppercase mb-0.5">Status Report Semanal</p>
                <h1 className="text-lg font-black uppercase tracking-tight leading-none">{report.area || 'Sistemas (TI)'}</h1>
                {report.execSummary.trim() && (
                  <p className="text-[10px] text-slate-300 mt-1.5 max-w-lg leading-snug">{report.execSummary}</p>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <div className="rounded-lg bg-white/10 px-2.5 py-1.5 text-right min-w-[100px]">
                <p className="flex items-center gap-1 justify-end text-[7.5px] uppercase tracking-wider text-sky-300 font-bold">
                  <IconCalendar className="w-2.5 h-2.5" />
                  Período
                </p>
                <p className="text-[10.5px] font-bold mt-0.5 leading-tight">{report.periodLabel}</p>
              </div>
              <div className="rounded-lg bg-white/10 px-2.5 py-1.5 text-right min-w-[100px]">
                <p className="text-[7.5px] uppercase tracking-wider text-sky-300 font-bold">Responsável</p>
                <p className="text-[10.5px] font-bold mt-0.5 leading-tight">{report.responsible || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 space-y-3.5">
          {/* 1. Panorama */}
          <section>
            <SectionTitle n={1}>Panorama da semana</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              <StatTile icon={IconCheck} color={STATUS_META.on_track.color} value={statusCounts.on_track} label="No prazo" />
              <StatTile icon={IconAlert} color={STATUS_META.attention.color} value={statusCounts.attention} label="Atenção" />
              <StatTile icon={IconClock} color={STATUS_META.delayed.color} value={statusCounts.delayed} label="Atrasados" />
              {report.indicators.map((ind, i) => {
                const Icon = INDICATOR_ICONS[i % INDICATOR_ICONS.length];
                const color = DECOR[(i + 1) % DECOR.length];
                return <StatTile key={ind.id} icon={Icon} color={color} value={ind.value} label={ind.label} />;
              })}
            </div>
          </section>

          {/* 2. Entregas - foco principal */}
          <section>
            <SectionTitle n={2}>★ Entregas da semana</SectionTitle>
            <div className={`grid gap-2 ${projectCols}`}>
              {report.projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>

          {/* 3. Avanços - também em destaque, um card por avanço */}
          <section>
            <SectionTitle n={3}>★ Avanços antecipados para a próxima semana</SectionTitle>
            {advances.length === 0 ? (
              <p className="text-slate-400 italic text-[10px]">Nenhum avanço antecipado registrado.</p>
            ) : (
              <div className={`grid gap-2 ${advanceCols}`}>
                {advances.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-white p-2.5 flex items-start gap-1.5"
                  >
                    <IconArrowRight className="w-3 h-3 text-sky-500 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-sky-900">
                      <span className="font-semibold">{a.project}: </span>
                      {normalizeCase(a.line)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Insights */}
          {insightCount > 0 && (
            <section>
              <SectionTitle n={4}>Insights da semana</SectionTitle>
              <div className={`grid gap-2 ${insightCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {highlightLines.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                    <p className="flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 uppercase tracking-wide mb-1">
                      <IconSpark className="w-3 h-3" /> Destaques
                    </p>
                    <div className="text-[10px] text-emerald-900 leading-snug">{renderLines(report.highlights)}</div>
                  </div>
                )}
                {attentionLines.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-2.5">
                    <p className="flex items-center gap-1 text-[9.5px] font-bold text-amber-800 uppercase tracking-wide mb-1">
                      <IconAlert className="w-3 h-3" /> Pontos de atenção
                    </p>
                    <div className="text-[10px] text-amber-900 leading-snug">{renderLines(report.attentionPoints)}</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 5. Próximos passos */}
          {nextSteps.length > 0 && (
            <section>
              <SectionTitle n={5}>Próximos passos</SectionTitle>
              {nextSteps.length === 1 ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 w-fit">
                  <IconArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-[9.5px] text-slate-700 leading-tight">
                    <span className="font-semibold text-slate-500">{nextSteps[0].project}: </span>
                    {normalizeCase(nextSteps[0].line)}
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-1 gap-y-2">
                  {nextSteps.map((s, i) => (
                    <div key={i} className="flex items-center">
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-1 pr-2.5 py-1">
                        <span
                          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8.5px] font-bold text-white shrink-0"
                          style={{ backgroundColor: DECOR[i % DECOR.length] }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[9.5px] text-slate-700 leading-tight">
                          <span className="font-semibold text-slate-500">{s.project}: </span>
                          {normalizeCase(s.line)}
                        </span>
                      </div>
                      {i < nextSteps.length - 1 && <IconArrowRight className="w-3 h-3 text-slate-300 mx-1 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 border-t border-slate-100 bg-white"
        style={{ height: FOOTER_H }}
      >
        <span className="text-[9px] text-slate-400">Gerado em {generatedAt}</span>
        <LogoOrigem className="h-4" />
      </div>
    </div>
  );
});

SnapshotView.displayName = 'SnapshotView';

export default SnapshotView;
