import { forwardRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { Atividade, BacklogItem, Objetivo, ObjetivoProgressSnapshot, Project, Report } from '../../types';
import { BACKLOG_PRIORITY_META, BACKLOG_STATUS_META, OBJETIVO_COLOR, STATUS_META } from '../../types';
import { buildRoadmapSnapshot, computeSnapshotHeroStats } from '../../lib/roadmap';
import StatusBadge from './StatusBadge';
import LogoOrigem from './LogoOrigem';
import { NAVY_900, NAVY_800, BLUE_ACCENT, LINE, PAGE_BG, INK_600, INK_400, PURPLE, DECOR } from './palette';
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
  /** Full report history — used only to sum entregas (projects) across ALL
   *  weeks for the hero's "concluídas desde o início do programa" figure;
   *  everything else in this view still reads from the single `report`. */
  reports: Report[];
  atividades: Atividade[];
  objetivos: Objetivo[];
  backlogItems: BacklogItem[];
}

// Fixed export width keeps PNG/PDF output consistent; height grows with
// content instead of being scaled/cropped to fit a fixed box, so items
// never get squeezed down to unreadable sizes on longer reports.
const FRAME_W = 1280;

// Section number badges (1-5) always use this single neutral color — the
// status palette (green/amber/red) is reserved exclusively for semaphore
// status, never for decoration.
const SECTION_COLOR = NAVY_900;

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

/**
 * A line written as "Label: detail" (the label short enough to be a real
 * label, not a sentence that happens to contain a colon) renders with the
 * part before the colon bolded — gives each bullet a title + what-was-done
 * shape without needing a separate structured field per line.
 */
function renderLine(line: string) {
  const colonIdx = line.indexOf(': ');
  if (colonIdx <= 0 || colonIdx > 48) return line;
  return (
    <>
      <span className="font-semibold">{line.slice(0, colonIdx)}:</span>
      {line.slice(colonIdx + 1)}
    </>
  );
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
          {renderLine(normalizeCase(line))}
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

function SectionTitle({ n, children, right }: { n: number; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: SECTION_COLOR }}
      >
        {n}
      </span>
      <h2 className="text-[15px] font-extrabold tracking-wide text-slate-900">{children}</h2>
      {right && <div className="ml-auto">{right}</div>}
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

/**
 * Compliance/volume hero band — the page's opening claim, right below the
 * navy header: how much got done this week, how much has accumulated since
 * the program started, and (when there's a real run) an on-time streak
 * badge. Deliberately its own component, not a numbered SectionTitle —
 * these are headline figures, not a report section.
 */
function HeroStats({ weekCount, totalCount, streakWeeks }: { weekCount: number; totalCount: number; streakWeeks: number }) {
  return (
    <div className="rounded-2xl bg-white px-7 py-5 flex flex-wrap items-center gap-x-8 gap-y-4" style={{ border: `1px solid ${LINE}` }}>
      <div>
        <p className="text-4xl font-extrabold text-slate-900 leading-none">{weekCount}</p>
        <p className="text-[11px] font-semibold mt-1.5" style={{ color: INK_600 }}>
          {weekCount === 1 ? 'entrega/atividade concluída' : 'entregas e atividades concluídas'} nesta semana
        </p>
      </div>
      <div className="w-px h-10 shrink-0" style={{ backgroundColor: LINE }} />
      <div>
        <p className="text-4xl font-extrabold text-slate-900 leading-none">{totalCount}</p>
        <p className="text-[11px] font-semibold mt-1.5" style={{ color: INK_600 }}>
          entregas e atividades concluídas desde o início do programa
        </p>
      </div>
      {streakWeeks > 0 && (
        <div
          className="ml-auto flex items-center gap-2 rounded-full pl-3 pr-4 py-2"
          style={{ background: '#e9f7ee', border: '1px solid #bfe6cd' }}
        >
          <IconSpark className="w-4 h-4 shrink-0" style={{ color: '#137a3c' }} />
          <span className="text-[12.5px] font-extrabold leading-tight" style={{ color: '#137a3c' }}>
            {streakWeeks} {streakWeeks === 1 ? 'semana consecutiva' : 'semanas consecutivas'} com entregas 100% no prazo
          </span>
        </div>
      )}
    </div>
  );
}

function DeliveryCard({
  project,
  index,
  objetivos,
  atividades,
}: {
  project: Project;
  index: number;
  objetivos: Objetivo[];
  atividades: Atividade[];
}) {
  const meta = STATUS_META[project.status];
  const bulletCount = linesOf(project.deliveries).length;
  const hasRisk = project.risks.trim().length > 0;
  const nextStepsLines = linesOf(project.nextSteps);

  // Roadmap stage this delivery belongs to — only knowable when the project
  // was created with "vincular ao roadmap" checked (Project.linkedAtividadeId).
  // An unlinked delivery shows no stage line rather than guessing one.
  const linkedAtividade = project.linkedAtividadeId ? atividades.find((a) => a.id === project.linkedAtividadeId) : null;
  const linkedObjetivo = linkedAtividade ? objetivos.find((o) => o.id === linkedAtividade.objetivoId) : null;

  // TODO(compliance-report): Project has no per-delivery "responsável" field
  // today — only Report.responsible, one person for the whole week. Once a
  // per-delivery owner exists in the data model, render it on the meta line
  // below (e.g. "👤 {responsavel} · 📁 {entregaLabel} — {objetivo.name}").

  // TODO(compliance-report): "área(s) envolvida(s)" (e.g. "Diagnóstico",
  // "Telemática") has no field on Project either — it's a different concept
  // from the roadmap stage above (a project can touch multiple orgs/domains
  // that don't map 1:1 to an Objetivo). Once that list exists, render it as
  // small colored pills in the footer, below the "Sem bloqueios" line.

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
        <StatusBadge status={project.status} label={project.status === 'on_track' ? 'Concluído' : undefined} />
      </div>
      {linkedObjetivo && (
        <p className="text-[11px] font-semibold" style={{ color: INK_400 }}>
          📁 {linkedObjetivo.entregaLabel} — {linkedObjetivo.name}
        </p>
      )}
      {bulletCount > 0 && (
        <p className="text-[11px] font-semibold" style={{ color: INK_400 }}>
          {bulletCount} de {bulletCount} itens concluídos
        </p>
      )}
      <div className="text-[12.5px] leading-snug flex-1" style={{ color: INK_600 }}>
        {renderLines(project.deliveries)}
      </div>
      {nextStepsLines.length > 0 && (
        <div className="text-[12.5px] leading-snug pt-2" style={{ borderTop: `1px dashed ${LINE}` }}>
          <p className="text-[10px] font-extrabold uppercase tracking-wide mb-1" style={{ color: PURPLE }}>
            Próximos passos
          </p>
          <div style={{ color: INK_600 }}>{renderLines(project.nextSteps)}</div>
        </div>
      )}
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

/**
 * Deliberately more compact than DeliveryCard — this section is reference
 * material (long-horizon roadmap position), not the report's focus, so it
 * trades detail for density: smaller padding/type, a shorter activity list.
 */
function ObjetivoCard({ snapshot, index }: { snapshot: ObjetivoProgressSnapshot; index: number }) {
  const color = DECOR[index % DECOR.length];
  const completedCount = snapshot.completedPlanned.length + snapshot.completedExtra.length;
  const notStarted = snapshot.progress === 0;

  return (
    <div
      className="rounded-xl bg-white p-3 flex flex-col gap-1.5"
      style={{ border: `1px solid ${LINE}`, borderTop: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide truncate" style={{ color }}>
            {snapshot.entregaLabel ?? ''}
          </p>
          <p className="text-xs font-bold leading-snug text-slate-900 truncate">{snapshot.name ?? 'Objetivo'}</p>
        </div>
        <span
          className="text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          Sem. {snapshot.weekOfQuarter}/{snapshot.totalWeeks ?? snapshot.weekOfQuarter}
        </span>
      </div>

      <div>
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: LINE }}>
          <div className="h-full rounded-full" style={{ width: `${snapshot.progress}%`, backgroundColor: color }} />
        </div>
        <p className="text-[10px] font-semibold mt-1" style={{ color: notStarted ? INK_400 : color }}>
          {notStarted ? 'Planejada' : `${snapshot.progress}% concluído`}
        </p>
      </div>

      <p className="text-[10.5px]" style={{ color: INK_400 }}>
        {completedCount === 0
          ? 'Nenhuma atividade concluída nesta semana.'
          : `${completedCount} ${completedCount === 1 ? 'atividade concluída' : 'atividades concluídas'} nesta semana`}
      </p>
    </div>
  );
}

function BacklogRow({ item, objetivos }: { item: BacklogItem; objetivos: Objetivo[] }) {
  const priorityMeta = BACKLOG_PRIORITY_META[item.priority];
  const statusMeta = BACKLOG_STATUS_META[item.status];
  const objetivo = item.objetivoId ? objetivos.find((o) => o.id === item.objetivoId) : null;

  return (
    <div
      className="rounded-xl bg-white px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
      style={{ border: `1px solid ${LINE}` }}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: objetivo ? OBJETIVO_COLOR[objetivo.id].bar : INK_400 }}
      />
      <p className="text-sm font-bold text-slate-900 min-w-[140px] flex-1">{item.name || 'Item de backlog sem nome'}</p>
      <span className="text-[11px]" style={{ color: INK_600 }}>
        {objetivo ? objetivo.name : 'Sem categoria'}
      </span>
      <span
        className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0"
        style={{ backgroundColor: `${priorityMeta.color}1A`, color: priorityMeta.color }}
      >
        {priorityMeta.label}
      </span>
      <span
        className="text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0"
        style={{ backgroundColor: `${statusMeta.color}1A`, color: statusMeta.color }}
      >
        {statusMeta.label}
      </span>
      {item.estimatedDueDate && (
        <span className="text-[11px]" style={{ color: INK_400 }}>
          Prazo: {item.estimatedDueDate}
        </span>
      )}
    </div>
  );
}

const SnapshotView = forwardRef<HTMLDivElement, Props>(({ report, reports, atividades, objetivos, backlogItems }, ref) => {
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

  const highlightLines = linesOf(report.highlights);
  const attentionLines = linesOf(report.attentionPoints);
  const insightCount = (highlightLines.length > 0 ? 1 : 0) + (attentionLines.length > 0 ? 1 : 0);

  const visibleIndicators = report.indicators.filter((ind) => ind.label.trim() || ind.value.trim());

  const backlogCounts = backlogItems.reduce(
    (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
    { nao_iniciado: 0, em_andamento: 0, concluido: 0 } as Record<string, number>,
  );

  // Compliance/volume hero figures — shared with the 16:9 slide export
  // (SnapshotSlideView) via computeSnapshotHeroStats, so the two can never
  // show different numbers for the same report.
  const { weekCompletedCount, totalCompletedCount, onTimeStreakWeeks, roadmapOverallProgress } = computeSnapshotHeroStats(
    report,
    reports,
    atividades,
    objetivos,
  );

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

        {/* Hero: compliance/volume headline figures */}
        <HeroStats weekCount={weekCompletedCount} totalCount={totalCompletedCount} streakWeeks={onTimeStreakWeeks} />

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

        {/* 2. Entregas - foco principal do relatório de compliance/volume */}
        <section>
          <SectionTitle n={2}>Entregas da semana</SectionTitle>
          <div className={`grid gap-4 ${gridColsFor(report.projects.length)}`}>
            {report.projects.map((p, i) => (
              <DeliveryCard key={p.id} project={p} index={i} objetivos={objetivos} atividades={atividades} />
            ))}
          </div>
        </section>

        {/* 3. Roadmap por objetivos — reference material, kept compact and
           below the week's actual deliveries so it reads as context, not
           the report's headline. */}
        <section>
          <SectionTitle
            n={3}
            right={
              <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ backgroundColor: `${SECTION_COLOR}0F`, color: SECTION_COLOR }}>
                {roadmapOverallProgress}% concluído no geral
              </span>
            }
          >
            Roadmap — Estruturação da Área de Sistemas
          </SectionTitle>
          <div className="grid grid-cols-4 gap-3">
            {roadmapData.map((s, i) => (
              <ObjetivoCard key={s.objetivoId} snapshot={s} index={i} />
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

        {/* 6. Próximos passos (nível do report) */}
        {report.nextSteps.trim() && (
          <section>
            <SectionTitle n={6}>Próximos Passos</SectionTitle>
            <div className="rounded-xl bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
              <div className="text-[12.5px] leading-snug" style={{ color: INK_600 }}>
                {renderLines(report.nextSteps)}
              </div>
            </div>
          </section>
        )}

        {/* 7. Backlog pendente — global, independente do report selecionado
           (mesma fonte de dados exibida ao vivo no Editor e na Timeline). */}
        {backlogItems.length > 0 && (
          <section>
            <SectionTitle n={7}>Backlog Pendente</SectionTitle>
            <div className="flex flex-wrap gap-4 mb-4">
              <StatTile icon={IconLayers} color={INK_600} tint="#eef1f7" value={backlogItems.length} label="Total no backlog" />
              <StatTile
                icon={IconClock}
                color={BACKLOG_STATUS_META.nao_iniciado.color}
                tint={`${BACKLOG_STATUS_META.nao_iniciado.color}1A`}
                value={backlogCounts.nao_iniciado}
                label="Não iniciado"
              />
              <StatTile
                icon={IconTrendingUp}
                color={BACKLOG_STATUS_META.em_andamento.color}
                tint={`${BACKLOG_STATUS_META.em_andamento.color}1A`}
                value={backlogCounts.em_andamento}
                label="Em andamento"
              />
              <StatTile
                icon={IconCheck}
                color={BACKLOG_STATUS_META.concluido.color}
                tint={`${BACKLOG_STATUS_META.concluido.color}1A`}
                value={backlogCounts.concluido}
                label="Concluído"
              />
            </div>
            <div className="space-y-2">
              {backlogItems.map((item) => (
                <BacklogRow key={item.id} item={item} objetivos={objetivos} />
              ))}
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
