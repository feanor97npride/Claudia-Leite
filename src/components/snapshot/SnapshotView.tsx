import { forwardRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { Atividade, Objetivo, ObjetivoProgressSnapshot, Project, Report } from '../../types';
import { STATUS_META } from '../../types';
import { buildRoadmapSnapshot } from '../../lib/roadmap';
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
  atividades: Atividade[];
  objetivos: Objetivo[];
}

// Fixed export width keeps PNG/PDF output consistent; height grows with
// content instead of being scaled/cropped to fit a fixed box, so items
// never get squeezed down to unreadable sizes on longer reports.
const FRAME_W = 1280;

// Palette lifted from the corporate reference template.
const NAVY_900 = '#0d1b3e';
const NAVY_800 = '#132250';
const BLUE_ACCENT = '#3b6fd6';
const LINE = '#e4e8f2';
const PAGE_BG = '#f3f5fa';
const INK_600 = '#54607a';
const INK_400 = '#8a93ab';
const PURPLE = '#6d4fd6';

// Section number badges (1-5) always use this single neutral color — the
// status palette (green/amber/red) is reserved exclusively for semaphore
// status, never for decoration.
const SECTION_COLOR = NAVY_900;

// Decorative accents for custom indicator tiles beyond the fixed three.
// Deliberately excludes green/amber/red so it never gets confused with the
// on-track/attention/delayed semaphore.
const DECOR = ['#0ea5b7', '#7c3aed', '#2563eb', '#0284c7', '#6366f1'];

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

function renderLines(text: string, twoCol = false) {
  const lines = linesOf(text);
  if (lines.length === 0) return <p className="text-slate-400 italic">—</p>;
  return (
    <ul
      className="space-y-1 list-disc list-inside marker:text-current"
      style={twoCol ? { columnCount: 2, columnGap: 32 } : undefined}
    >
      {lines.map((line, i) => (
        <li key={i} style={{ breakInside: 'avoid' }}>
          {normalizeCase(line)}
        </li>
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
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: SECTION_COLOR }}
      >
        {n}
      </span>
      <h2 className="text-[15px] font-extrabold tracking-wide text-slate-900">{children}</h2>
    </div>
  );
}

function StatTile({
  icon: Icon,
  color,
  tint,
  value,
  label,
}: {
  icon: (props: { className?: string; style?: CSSProperties }) => ReactElement;
  color: string;
  tint: string;
  value: string | number;
  label: string;
}) {
  return (
    <div
      className="rounded-xl bg-white px-5 py-3.5 flex items-center gap-3 min-w-[150px]"
      style={{ border: `1px solid ${LINE}` }}
    >
      <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: tint }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-extrabold leading-none">{value}</p>
        <p className="text-xs mt-0.5" style={{ color: INK_600 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function DeliveryCard({ project, index }: { project: Project; index: number }) {
  const meta = STATUS_META[project.status];
  const bulletCount = linesOf(project.deliveries).length;
  const hasRisk = project.risks.trim().length > 0;

  return (
    <div
      className="rounded-2xl bg-white p-4 flex flex-col gap-2.5"
      style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${meta.color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5"
            style={{ backgroundColor: SECTION_COLOR }}
          >
            {index + 1}
          </span>
          <p className="text-sm font-bold leading-snug text-slate-900">{project.name || 'Projeto sem nome'}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      {bulletCount > 0 && (
        <p className="text-[11px] font-semibold" style={{ color: INK_400 }}>
          {bulletCount} de {bulletCount} itens concluídos
        </p>
      )}
      <div className="text-[12.5px] leading-snug flex-1" style={{ color: INK_600 }}>
        {renderLines(project.deliveries)}
      </div>
      <div
        className="text-[11px] pt-2"
        style={{
          borderTop: `1px dashed ${LINE}`,
          color: hasRisk ? STATUS_META.delayed.color : INK_400,
          fontWeight: hasRisk ? 600 : 400,
        }}
      >
        {hasRisk ? `⚠ ${normalizeCase(project.risks.trim())}` : 'Sem bloqueios identificados'}
      </div>
    </div>
  );
}

function ObjetivoCard({ snapshot, index }: { snapshot: ObjetivoProgressSnapshot; index: number }) {
  const color = DECOR[index % DECOR.length];
  const hasActivity = snapshot.completedPlanned.length > 0 || snapshot.completedExtra.length > 0;

  return (
    <div
      className="rounded-2xl bg-white p-4 flex flex-col gap-2.5"
      style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
            {snapshot.entregaLabel ?? ''}
            {snapshot.entregaLabel && snapshot.periodLabel ? ' · ' : ''}
            <span className="normal-case">{snapshot.periodLabel ?? ''}</span>
          </p>
          <p className="text-sm font-bold leading-snug text-slate-900">{snapshot.name ?? 'Objetivo'}</p>
        </div>
        <span
          className="text-[10px] font-bold rounded-full px-2 py-1 shrink-0"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          Semana {snapshot.weekOfQuarter} de {snapshot.totalWeeks ?? snapshot.weekOfQuarter}
        </span>
      </div>

      <div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: LINE }}>
          <div className="h-full rounded-full" style={{ width: `${snapshot.progress}%`, backgroundColor: color }} />
        </div>
        <p className="text-[11px] font-semibold mt-1" style={{ color: INK_400 }}>
          {snapshot.progress}% concluído
        </p>
      </div>

      <div className="text-[12px] leading-snug flex-1" style={{ color: INK_600 }}>
        {!hasActivity ? (
          <p className="text-slate-400 italic">Nenhuma atividade concluída nesta semana.</p>
        ) : (
          <ul className="space-y-1">
            {snapshot.completedPlanned.map((a) => (
              <li key={a.id} className="flex items-start gap-1.5">
                <IconCheck className="w-3 h-3 shrink-0 mt-0.5" style={{ color: STATUS_META.on_track.color }} />
                <span>{a.name}</span>
              </li>
            ))}
            {snapshot.completedExtra.map((a) => (
              <li key={a.id} className="flex items-start gap-1.5">
                <IconCheck className="w-3 h-3 shrink-0 mt-0.5" style={{ color: STATUS_META.on_track.color }} />
                <span>{a.name}</span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 shrink-0"
                  style={{ backgroundColor: `${PURPLE}1A`, color: PURPLE }}
                >
                  Extra
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const SnapshotView = forwardRef<HTMLDivElement, Props>(({ report, atividades, objetivos }, ref) => {
  const roadmapData: ObjetivoProgressSnapshot[] =
    report.roadmapSnapshot ?? buildRoadmapSnapshot(atividades, report.weekStart, objetivos);
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(report.updatedAt));

  const statusCounts = report.projects.reduce(
    (acc, p) => ({ ...acc, [p.status]: acc[p.status] + 1 }),
    { on_track: 0, attention: 0, delayed: 0 } as Record<string, number>,
  );

  const advances = report.projects
    .filter((p) => p.nextWeekAdvances.trim())
    .flatMap((p) => linesOf(p.nextWeekAdvances).map((line) => ({ project: p.name || 'Projeto', line })));

  const nextSteps = report.projects
    .filter((p) => p.nextSteps.trim())
    .flatMap((p) => linesOf(p.nextSteps).map((line) => ({ project: p.name || 'Projeto', line })));

  const highlightLines = linesOf(report.highlights);
  const attentionLines = linesOf(report.attentionPoints);
  const insightCount = (highlightLines.length > 0 ? 1 : 0) + (attentionLines.length > 0 ? 1 : 0);

  const visibleIndicators = report.indicators.filter((ind) => ind.label.trim() || ind.value.trim());

  return (
    <div
      ref={ref}
      className="snapshot-frame rounded-2xl shadow-sm overflow-hidden text-slate-900"
      style={{ width: FRAME_W, backgroundColor: PAGE_BG, border: `1px solid ${LINE}`, fontSize: '12px' }}
    >
      <div className="p-7 space-y-7">
        {/* Header */}
        <div
          className="rounded-2xl px-8 py-6 flex items-start justify-between gap-6 text-white"
          style={{ background: `linear-gradient(135deg, ${NAVY_900}, ${NAVY_800})` }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${BLUE_ACCENT}, #5b8ff0)` }}
            >
              <IconLayers className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-1" style={{ color: '#9db4e8' }}>
                Status Report Semanal
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight leading-none mb-2">
                {report.area || 'Sistemas (TI)'}
              </h1>
              {report.execSummary.trim() && (
                <p className="text-[13.5px] leading-relaxed max-w-xl" style={{ color: '#c3cde8' }}>
                  {report.execSummary}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <div
              className="rounded-lg px-4 py-2.5 min-w-[150px]"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}
            >
              <p
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold mb-1"
                style={{ color: '#9db4e8' }}
              >
                <IconCalendar className="w-3 h-3" />
                Período
              </p>
              <p className="text-sm font-bold leading-tight">{report.periodLabel}</p>
            </div>
            <div
              className="rounded-lg px-4 py-2.5 min-w-[150px]"
              style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}
            >
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#9db4e8' }}>
                Responsável
              </p>
              <p className="text-sm font-bold leading-tight">{report.responsible || '—'}</p>
            </div>
          </div>
        </div>

        {/* 1. Panorama */}
        <section>
          <SectionTitle n={1}>Panorama da semana</SectionTitle>
          <div className="flex flex-wrap gap-4">
            <StatTile
              icon={IconCheck}
              color={STATUS_META.on_track.color}
              tint="#e9f7ee"
              value={statusCounts.on_track}
              label="No prazo"
            />
            <StatTile
              icon={IconAlert}
              color={STATUS_META.attention.color}
              tint="#fef3e6"
              value={statusCounts.attention}
              label="Atenção"
            />
            <StatTile
              icon={IconClock}
              color={STATUS_META.delayed.color}
              tint="#fdeaea"
              value={statusCounts.delayed}
              label="Atrasados"
            />
            {visibleIndicators.map((ind, i) => {
              const Icon = INDICATOR_ICONS[i % INDICATOR_ICONS.length];
              const color = DECOR[(i + 1) % DECOR.length];
              return <StatTile key={ind.id} icon={Icon} color={color} tint={`${color}1A`} value={ind.value} label={ind.label} />;
            })}
          </div>
        </section>

        {/* 2. Roadmap por objetivos */}
        <section>
          <SectionTitle n={2}>Roadmap — Estruturação da Área de Sistemas</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            {roadmapData.map((s, i) => (
              <ObjetivoCard key={s.objetivoId} snapshot={s} index={i} />
            ))}
          </div>
        </section>

        {/* 3. Entregas - foco principal */}
        <section>
          <SectionTitle n={3}>Entregas da semana</SectionTitle>
          <div className={`grid gap-4 ${gridColsFor(report.projects.length)}`}>
            {report.projects.map((p, i) => (
              <DeliveryCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </section>

        {/* 4. Avanços - um card por avanço */}
        <section>
          <SectionTitle n={4}>Avanços antecipados para a próxima semana</SectionTitle>
          {advances.length === 0 ? (
            <p className="text-slate-400 italic text-[11px]">Nenhum avanço antecipado registrado.</p>
          ) : (
            <div className="space-y-2.5">
              {advances.map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl flex items-start gap-2.5 px-5 py-3.5 text-sm"
                  style={{ background: '#eef4ff', border: '1px solid #cddcf9' }}
                >
                  <IconArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: BLUE_ACCENT }} />
                  <p>
                    <span className="font-bold" style={{ color: NAVY_800 }}>
                      {a.project}:
                    </span>{' '}
                    {normalizeCase(a.line)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. Insights */}
        {insightCount > 0 && (
          <section>
            <SectionTitle n={5}>Insights da semana</SectionTitle>
            <div className={`grid gap-4 ${insightCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {highlightLines.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: '#e9f7ee', border: '1px solid #bfe6cd' }}>
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
                    style={{ color: '#137a3c' }}
                  >
                    <IconSpark className="w-3.5 h-3.5" /> Destaques
                  </p>
                  <div className="text-[13px] leading-snug" style={{ color: '#1c3a28' }}>
                    {renderLines(report.highlights, highlightLines.length > 3)}
                  </div>
                </div>
              )}
              {attentionLines.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: '#fef3e6', border: '1px solid #f4d9ab' }}>
                  <p
                    className="text-[11px] font-extrabold uppercase tracking-widest mb-2.5 flex items-center gap-1.5"
                    style={{ color: '#92400e' }}
                  >
                    <IconAlert className="w-3.5 h-3.5" /> Pontos de atenção
                  </p>
                  <div className="text-[13px] leading-snug" style={{ color: '#78350f' }}>
                    {renderLines(report.attentionPoints, attentionLines.length > 3)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 6. Próximos passos por projeto */}
        {nextSteps.length > 0 && (
          <section>
            <SectionTitle n={6}>Próximos passos por projeto</SectionTitle>
            {nextSteps.length === 1 ? (
              <div
                className="rounded-xl bg-white p-3.5 flex items-center gap-2.5 w-fit"
                style={{ border: `1px solid ${LINE}` }}
              >
                <IconArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: INK_400 }} />
                <p className="text-[12.5px] leading-snug">
                  <span className="font-bold">{nextSteps[0].project}:</span> {normalizeCase(nextSteps[0].line)}
                </p>
              </div>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {nextSteps.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-white p-3.5 flex gap-3 items-start"
                    style={{ border: `1px solid ${LINE}` }}
                  >
                    <span
                      className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-white text-[11px] font-extrabold shrink-0"
                      style={{ backgroundColor: PURPLE }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[12.5px] leading-snug">
                      <span className="font-bold">{s.project}:</span> {normalizeCase(s.line)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 7. Próximos passos (nível do report) */}
        {report.nextSteps.trim() && (
          <section>
            <SectionTitle n={7}>Próximos Passos</SectionTitle>
            <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
              <div className="text-[12.5px] leading-snug" style={{ color: INK_600 }}>
                {renderLines(report.nextSteps)}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs pt-1" style={{ color: INK_400 }}>
          <span>Gerado em {generatedAt}</span>
          <LogoOrigem className="text-sm" />
        </div>
      </div>
    </div>
  );
});

SnapshotView.displayName = 'SnapshotView';

export default SnapshotView;
