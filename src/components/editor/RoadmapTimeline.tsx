import { useEffect, useRef, useState } from 'react';
import type { Atividade, AtividadePatch, BacklogItem, Objetivo, ObjetivoId, Project, TimelineVisualStatus } from '../../types';
import { BACKLOG_PRIORITY_META, BACKLOG_STATUS_META, OBJETIVO_COLOR, STATUS_META, TIMELINE_STATUS_META } from '../../types';
import {
  atividadesForObjetivo,
  computeBarFillPercent,
  computeObjetivoProgress,
  isVisibleInTimeline,
  timelineVisualStatus,
} from '../../lib/roadmap';
import type { ZoomLevel } from '../../lib/timelinePeriods';
import {
  ZOOM_LEVEL_META,
  buildPeriods,
  groupPeriodsByMonth,
  periodColumnRange,
  todayPeriodPosition,
} from '../../lib/timelinePeriods';
import { formatObjetivoPeriodLabel, formatShortDate, todayISO } from '../../utils/date';
import ActivityDetailPanel from './ActivityDetailPanel';
import NewActivityModal from './NewActivityModal';
import HoverPreviewCard from './HoverPreviewCard';
import TimelineStatCards from './TimelineStatCards';

/** Header ruler navy tones (mockup's palette) — kept local to the Timeline
 *  since nothing else in the app uses this dark navbar-style scheme. */
const HEADER_NAVY = '#1E2A47';
const HEADER_MONTH_BG = '#2A3A5C';
const HEADER_MONTH_TODAY_BG = '#3B4C78';

/** Background of the "Período" row (Entrega N + date range, 2nd header
 *  row) — the dashboard's own dark neutral, deliberately solid instead of a
 *  lighter tint of the categoria color, so it reads as distinct from the
 *  "Objetivos" row above it (which keeps the categoria's solid color). */
const PERIODO_ROW_BG = '#0B0F2E';

/** One report's free-narrative Project plus the ISO Monday of the report it
 *  came from — every report contributes its own items, not just the most
 *  recent one (Melhoria 2.2's "accumulated view" applies here too, same as
 *  it does to done extras: last week's "Atividades da Semana" don't
 *  disappear once a newer report exists). */
export interface ManualTimelineItem {
  project: Project;
  weekStart: string;
}

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  /** Every report's free-narrative "Projetos / Iniciativas da Semana",
   *  across the whole history — not governed roadmap data, shown as its own
   *  optional group ("Atividades da Semana", Melhoria 2). Most items have
   *  no prazo of their own (only their own report's weekStart, used as the
   *  point-marker fallback date); an item that does set plannedStart/
   *  plannedEnd gets a normal range bar instead. */
  manualItems: ManualTimelineItem[];
  /** Global backlog items (own table, independent of any report) — shown as
   *  their own neutral/gray band, always a point marker at estimatedDueDate
   *  (falling back to createdAt when no prazo was set), never a bar: unlike
   *  Project/Atividade, a backlog item never has a date RANGE of its own. */
  backlogItems: BacklogItem[];
  /** Real "today" Monday (ISO), independent of any report selected in
   *  History (Melhoria 2.2) — the Roadmap's own time anchor, used for the
   *  "hoje" line and to decide which still-open extras count as current. */
  currentWeekStart: string;
  readOnly: boolean;
  onEditAtividade: (objetivoId: ObjetivoId, atividadeId: string) => void;
  /** Saves a partial edit made from the detail panel (status, responsável,
   *  descrição, subtarefas) — prazo/objetivo stay governed elsewhere (see
   *  onEditAtividade), so this panel never sends those fields. */
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  /** "+ Nova Atividade" (mockup navbar) — reuses the same create-extra flow
   *  already used by the Editor, just with the planned dates set up front. */
  onCreateAtividade: (objetivoId: ObjetivoId, name: string, plannedStart: string, plannedEnd: string) => Promise<Atividade>;
}

/** Not a real ObjetivoId — a manual color token for the synthetic
 *  "Atividades da Semana" group, purple to match the "Extra" badge already
 *  used elsewhere for ad-hoc (non-governed) items. */
const MANUAL_GROUP_COLOR = { tint: '#faf5ff', text: '#7e22ce', bar: '#a855f7' };

/** Not a real ObjetivoId either — a neutral gray token for the "Backlog"
 *  group, deliberately dull/desaturated so it reads as "not yet on the
 *  governed roadmap" next to the vivid Objetivo palette. */
const BACKLOG_GROUP_COLOR = { tint: '#f8fafc', text: '#475569', bar: '#94a3b8' };

const HOVER_SHOW_DELAY = 250;
const HOVER_HIDE_DELAY = 150;

type PreviewState = { atividade: Atividade; objetivo: Objetivo; anchorRect: DOMRect } | null;

/**
 * Bloco de referência: um Gantt gerado ao vivo a partir dos períodos dos
 * Objetivos e das datas planejadas das Atividades — a "visão de linha de
 * base" que o roadmap original propôs, sempre em sincronia com o dado real
 * (ao contrário de uma imagem estática, nunca fica desatualizado). Só
 * atividades com início E fim planejados definidos entram no gráfico —
 * sem inventar datas para o que ainda não foi planejado.
 */
export default function RoadmapTimeline({
  objetivos,
  atividades,
  manualItems,
  backlogItems,
  currentWeekStart,
  readOnly,
  onEditAtividade,
  onUpdateAtividade,
  onCreateAtividade,
}: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const periodColRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selected, setSelected] = useState<{ atividade: Atividade; objetivo: Objetivo } | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [todayLeft, setTodayLeft] = useState<number | null>(null);
  const [monthDividerLefts, setMonthDividerLefts] = useState<number[]>([]);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [collapsed, setCollapsed] = useState<Set<ObjetivoId>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [showManualProjects, setShowManualProjects] = useState(true);
  const [backlogCollapsed, setBacklogCollapsed] = useState(false);
  const [showBacklogItems, setShowBacklogItems] = useState(true);
  const [categoriaFilter, setCategoriaFilter] = useState<Set<ObjetivoId>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<TimelineVisualStatus>>(new Set());
  const [responsavelFilter, setResponsavelFilter] = useState<Set<string>>(new Set());
  const [showNewActivity, setShowNewActivity] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = todayISO();
  // Computed unconditionally (before the objetivos.length===0 early return
  // below) so the "today" marker effect — a hook — can depend on it without
  // breaking the Rules of Hooks.
  const periods =
    objetivos.length === 0
      ? []
      : buildPeriods(
          zoom,
          objetivos.reduce((min, o) => (o.periodStart < min ? o.periodStart : min), objetivos[0].periodStart),
          objetivos.reduce((max, o) => (o.periodEnd > max ? o.periodEnd : max), objetivos[0].periodEnd),
        );
  // Melhoria 1: only meaningful at 'day' zoom — grouping week/month/quarter
  // columns by calendar month wouldn't make sense (they already span/exceed
  // a month each).
  const monthGroups = zoom === 'day' ? groupPeriodsByMonth(periods) : [];
  const todayPosition = todayPeriodPosition(periods, today);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // "Hoje" marker: period columns use a variable `minmax(...)` width, not a
  // fixed px value, so its pixel position is measured from the
  // actually-rendered column (two-pass, same idea as HoverPreviewCard)
  // rather than computed from guessed widths — kept accurate across window
  // resizes, zoom-level changes and the fullscreen toggle.
  useEffect(() => {
    if (!todayPosition) {
      setTodayLeft(null);
      return;
    }
    function recompute() {
      const col = periodColRefs.current[todayPosition!.idx];
      const container = gridRef.current;
      if (!col || !container) return;
      const colRect = col.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setTodayLeft(colRect.left - containerRect.left + colRect.width * todayPosition!.fraction);
    }
    recompute();
    const observer = new ResizeObserver(recompute);
    if (gridRef.current) observer.observe(gridRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [todayPosition?.idx, todayPosition?.fraction, isFullscreen]);

  // Melhoria 1: stronger divider lines at each month boundary, 'day' zoom
  // only — same two-pass measurement idea as the "hoje" marker above (day
  // columns don't have a fixed px width either).
  useEffect(() => {
    if (zoom !== 'day' || monthGroups.length <= 1) {
      setMonthDividerLefts([]);
      return;
    }
    function recompute() {
      const container = gridRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const lefts: number[] = [];
      // Skip the first group — there's no boundary before the very first
      // displayed column.
      for (let i = 1; i < monthGroups.length; i++) {
        const col = periodColRefs.current[monthGroups[i].startIdx];
        if (!col) continue;
        lefts.push(col.getBoundingClientRect().left - containerRect.left);
      }
      setMonthDividerLefts(lefts);
    }
    recompute();
    const observer = new ResizeObserver(recompute);
    if (gridRef.current) observer.observe(gridRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [zoom, periods.length, isFullscreen]);

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Touch devices have no hover — the same items switch to a tap-to-preview,
  // tap-again-or-outside-to-close pattern instead (handled per-item below).
  // (hover: none) is the robust check — 'ontouchstart' in window false-
  // positives on touch-capable laptops that are still primarily mouse-driven.
  const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  useEffect(() => {
    if (!isTouch || !preview) return;
    function handleOutside(e: PointerEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) {
        // Let item-level tap handlers manage their own open/close/switch —
        // only close here when the tap landed outside the whole Timeline
        // block (e.g. on the page background).
        const hitItem = (target as HTMLElement).closest?.('[data-hover-item]');
        const hitCard = (target as HTMLElement).closest?.('[role="tooltip"]');
        if (hitItem || hitCard) return;
      }
      setPreview(null);
    }
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [isTouch, preview]);

  function clearTimers() {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function scheduleShow(atividade: Atividade, objetivo: Objetivo, target: HTMLElement) {
    if (isTouch) return;
    clearTimers();
    showTimer.current = setTimeout(() => {
      setPreview({ atividade, objetivo, anchorRect: target.getBoundingClientRect() });
    }, HOVER_SHOW_DELAY);
  }

  function scheduleHide() {
    if (isTouch) return;
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPreview(null), HOVER_HIDE_DELAY);
  }

  function cancelHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function handleItemTap(atividade: Atividade, objetivo: Objetivo, target: HTMLElement) {
    if (preview?.atividade.id === atividade.id) {
      // Second tap on the same item — progress straight to the full detail.
      setPreview(null);
      setSelected({ atividade, objetivo });
    } else {
      setPreview({ atividade, objetivo, anchorRect: target.getBoundingClientRect() });
    }
  }

  function toggleCollapse(objetivoId: ObjetivoId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(objetivoId)) next.delete(objetivoId);
      else next.add(objetivoId);
      return next;
    });
  }

  /** Every filter dimension is a Set — empty means "no filter" (show all)
   *  for that dimension; multiple selections within one dimension are OR'd
   *  together, and the 3 dimensions are AND'd. */
  function toggleInSet<T>(setState: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }

  if (objetivos.length === 0) return null;

  // Objetivos/Período ruler bands (mockup items 2-3): each objetivo's own
  // period mapped onto the currently displayed columns, chronologically —
  // `cursor` tracks how many columns are already consumed so consecutive
  // bands (and any gap between them) never overlap. Both the "Objetivos"
  // and "Período" rows below are built from this SAME segment list, just
  // styled differently.
  type BandSegment = { kind: 'gap'; span: number } | { kind: 'objetivo'; objetivo: Objetivo; span: number };
  const objetivoBandSegments: BandSegment[] = [];
  {
    let cursor = 0;
    const sorted = [...objetivos].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    for (const o of sorted) {
      const range = periodColumnRange(o.periodStart, o.periodEnd, periods);
      if (!range) continue;
      if (range.startIdx > cursor) objetivoBandSegments.push({ kind: 'gap', span: range.startIdx - cursor });
      objetivoBandSegments.push({ kind: 'objetivo', objetivo: o, span: range.span });
      cursor = range.startIdx + range.span;
    }
    if (cursor < periods.length) objetivoBandSegments.push({ kind: 'gap', span: periods.length - cursor });
  }
  // Corner "Atividade" cell spans every header row: Objetivos + Período +
  // Meses, plus the extra month-group row that only exists at 'day' zoom.
  const headerRowCount = 3 + (monthGroups.length > 0 ? 1 : 0);

  // Every atividade eligible to appear in the Gantt at all (has planned
  // start/end, visible this week) — independent of the filter chips below.
  // Used both to derive filter options (categoria/responsável) and to tell
  // "no plannable data yet" apart from "filters hid everything".
  const eligibleRows = objetivos.flatMap((objetivo) =>
    atividadesForObjetivo(objetivo.id, atividades)
      .filter((a) => isVisibleInTimeline(a, currentWeekStart))
      .filter((a): a is Atividade & { plannedStart: string; plannedEnd: string } => !!a.plannedStart && !!a.plannedEnd)
      .map((atividade) => ({ atividade, objetivo })),
  );
  // Indicator cards above the grid (mockup item 4) — scoped to the same
  // "eligible" universe as the grid itself, independent of which filter
  // chips are currently active.
  const eligibleStatuses = eligibleRows.map(({ atividade }) => timelineVisualStatus(atividade, today));

  const responsavelOptions = Array.from(
    new Set(
      eligibleRows
        .flatMap(({ atividade }) => [atividade.raciAccountableName, atividade.raciResponsibleName])
        .map((n) => n?.trim())
        .filter((n): n is string => !!n),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  function matchesFilters({ atividade, objetivo }: (typeof eligibleRows)[number]): boolean {
    if (categoriaFilter.size > 0 && !categoriaFilter.has(objetivo.id)) return false;
    if (statusFilter.size > 0 && !statusFilter.has(timelineVisualStatus(atividade, today))) return false;
    if (responsavelFilter.size > 0) {
      const names = [atividade.raciAccountableName, atividade.raciResponsibleName]
        .map((n) => n?.trim())
        .filter((n): n is string => !!n);
      if (!names.some((n) => responsavelFilter.has(n))) return false;
    }
    return true;
  }

  const filteredRows = eligibleRows.filter(matchesFilters);
  const hasActiveFilters = categoriaFilter.size > 0 || statusFilter.size > 0 || responsavelFilter.size > 0;

  const groups = objetivos
    .map((objetivo) => ({
      objetivo,
      rows: filteredRows
        .filter((r) => r.objetivo.id === objetivo.id)
        .map(({ atividade }) => ({
          atividade,
          range: periodColumnRange(atividade.plannedStart, atividade.plannedEnd, periods),
        }))
        .filter((row): row is typeof row & { range: { startIdx: number; span: number } } => row.range !== null),
    }))
    .filter((group) => group.rows.length > 0);

  // Melhoria 2: every report's free-narrative "Projetos / Iniciativas da
  // Semana" (shown here as "Atividades da Semana") accumulate across the
  // whole history, not just the most recent report's (2.2) — an item
  // usually has no plannedStart/plannedEnd of its own, so it's placed as a
  // single-day point at ITS OWN report's weekStart, not a bar. An item that
  // DOES set a prazo (Melhoria 2.1) gets a normal range bar instead, same
  // placement logic as a governed atividade. Falls off the Timeline
  // entirely if its date(s) land outside the displayed period range (same
  // "no range, no row" convention already used for atividades).
  const manualEligibleRows = manualItems
    .map(({ project, weekStart }) => {
      const hasOwnDates = !!(project.plannedStart && project.plannedEnd);
      const range = hasOwnDates
        ? periodColumnRange(project.plannedStart!, project.plannedEnd!, periods)
        : periodColumnRange(weekStart, weekStart, periods);
      return { project, weekStart, range, hasOwnDates };
    })
    .filter(
      (
        r,
      ): r is { project: Project; weekStart: string; range: { startIdx: number; span: number }; hasOwnDates: boolean } =>
        r.range !== null,
    );
  const manualRows = showManualProjects ? manualEligibleRows : [];

  // Backlog band: always a single point marker (estimatedDueDate, falling
  // back to the item's own createdAt when no prazo was set yet) — never a
  // range bar, since a backlog item has only one date field of its own.
  const backlogEligibleRows = backlogItems
    .map((item) => {
      const pointDate = item.estimatedDueDate ?? item.createdAt.slice(0, 10);
      const range = periodColumnRange(pointDate, pointDate, periods);
      return { item, pointDate, range };
    })
    .filter(
      (r): r is { item: BacklogItem; pointDate: string; range: { startIdx: number; span: number } } => r.range !== null,
    );
  const backlogRows = showBacklogItems ? backlogEligibleRows : [];
  const hasAnyVisibleGroup = groups.length > 0 || manualRows.length > 0 || backlogRows.length > 0;

  // Zebra striping index — a plain counter (not state) incremented in
  // render order as rows are mapped below, so alternating rows read
  // consistently regardless of which groups are collapsed/filtered out.
  let rowIndex = -1;

  return (
    <section
      ref={containerRef}
      className={
        isFullscreen
          ? 'bg-white p-6 h-full overflow-hidden flex flex-col xl:flex-row gap-4'
          : 'rounded-xl border border-slate-200 bg-white p-4 flex flex-col xl:flex-row gap-4 max-h-[75vh]'
      }
    >
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roadmap — Visão Timeline</h2>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowNewActivity(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium border border-slate-300 bg-white rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              + Nova Atividade
            </button>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-500 text-white rounded-lg px-2.5 py-1.5">
            Hoje: {formatShortDate(today)}
          </span>
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Zoom temporal">
            {(Object.keys(ZOOM_LEVEL_META) as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={`text-[11px] font-medium rounded px-2 py-1 transition-colors cursor-pointer ${
                  zoom === z ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {ZOOM_LEVEL_META[z].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors cursor-pointer"
          >
            {isFullscreen ? '⤡ Sair da tela cheia' : '⤢ Tela cheia'}
          </button>
        </div>
      </div>
      {eligibleStatuses.length > 0 && <TimelineStatCards statuses={eligibleStatuses} />}
      {eligibleRows.length === 0 && manualEligibleRows.length === 0 && backlogEligibleRows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Nenhuma atividade com início e fim planejados definidos ainda — defina o "Prazo" de uma
          atividade no Roadmap acima (modo de edição de um Objetivo) para ela aparecer aqui.
        </p>
      ) : (
        <div className="flex flex-col flex-1 min-h-[220px] overflow-hidden">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2 mb-3 text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-medium shrink-0">Categoria:</span>
              {objetivos.map((o) => {
                const color = OBJETIVO_COLOR[o.id];
                const active = categoriaFilter.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleInSet(setCategoriaFilter, o.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors cursor-pointer ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color.bar }} />
                    {o.name}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 font-medium shrink-0">Status:</span>
              {(Object.keys(TIMELINE_STATUS_META) as TimelineVisualStatus[]).map((s) => {
                const meta = TIMELINE_STATUS_META[s];
                const active = statusFilter.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleInSet(setStatusFilter, s)}
                    aria-pressed={active}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors cursor-pointer ${
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.bg, border: meta.border ? `1px solid ${meta.border}` : 'none' }}
                    />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {responsavelOptions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-medium shrink-0">Responsável:</span>
                {responsavelOptions.map((name) => {
                  const active = responsavelFilter.has(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleInSet(setResponsavelFilter, name)}
                      aria-pressed={active}
                      className={`rounded-full px-2 py-0.5 border transition-colors cursor-pointer ${
                        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            {manualEligibleRows.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowManualProjects((v) => !v)}
                  aria-pressed={showManualProjects}
                  title="Atividades da Semana cadastradas no Editor (narrativa livre) — não fazem parte do roadmap governado"
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors cursor-pointer ${
                    showManualProjects
                      ? 'text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                  style={
                    showManualProjects
                      ? { borderColor: MANUAL_GROUP_COLOR.bar, backgroundColor: MANUAL_GROUP_COLOR.bar }
                      : undefined
                  }
                >
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rotate-45 rounded-[1px] shrink-0"
                    style={{ backgroundColor: showManualProjects ? '#ffffff' : MANUAL_GROUP_COLOR.bar }}
                  />
                  Atividades da Semana
                </button>
              </div>
            )}
            {backlogEligibleRows.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowBacklogItems((v) => !v)}
                  aria-pressed={showBacklogItems}
                  title="Itens de backlog cadastrados no Editor — ainda não fazem parte do roadmap governado"
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors cursor-pointer ${
                    showBacklogItems ? 'text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                  style={
                    showBacklogItems
                      ? { borderColor: BACKLOG_GROUP_COLOR.bar, backgroundColor: BACKLOG_GROUP_COLOR.bar }
                      : undefined
                  }
                >
                  <span
                    aria-hidden="true"
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: showBacklogItems ? '#ffffff' : 'transparent',
                      border: `1.5px solid ${showBacklogItems ? '#ffffff' : BACKLOG_GROUP_COLOR.bar}`,
                    }}
                  />
                  Backlog
                </button>
              </div>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setCategoriaFilter(new Set());
                  setStatusFilter(new Set());
                  setResponsavelFilter(new Set());
                }}
                className="text-slate-400 hover:text-slate-900 underline underline-offset-2 shrink-0"
              >
                Limpar filtros
              </button>
            )}
          </div>
          {!hasAnyVisibleGroup ? (
            <p className="text-xs text-slate-400 italic">Nenhuma atividade corresponde aos filtros selecionados.</p>
          ) : (
        <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
          {/* Header (corner + month row + period ruler) is its own grid,
             deliberately NOT part of the vertically-scrolling body below —
             it shares the body's exact column template so columns line up,
             but staying outside the scroll container is simpler and more
             robust than juggling multi-row sticky offsets (a 2-row header
             only exists at 'day' zoom, which would need two different
             `position: sticky; top` values). Both grids sit inside this one
             `overflow-x-auto` ancestor, so they scroll horizontally in sync
             as a single unit. */}
          <div
            className="grid text-[11px] min-w-[720px] shrink-0"
            style={{ gridTemplateColumns: `176px repeat(${periods.length}, minmax(${ZOOM_LEVEL_META[zoom].minColWidth}px, 1fr))` }}
          >
            <div
              className="sticky left-0 z-20 text-white font-semibold px-2 py-1.5 rounded-tl-md shadow-[3px_0_6px_-2px_rgba(0,0,0,0.35)] flex items-center"
              style={{ gridRow: `span ${headerRowCount}`, backgroundColor: HEADER_NAVY }}
            >
              Atividade
            </div>
            {/* Objetivos band (mockup item 2/3): each objetivo's own color,
               spanning the columns its period covers. */}
            {objetivoBandSegments.map((seg, i) =>
              seg.kind === 'gap' ? (
                <div key={`obj-gap-${i}`} style={{ gridColumn: `span ${seg.span}`, backgroundColor: HEADER_NAVY }} />
              ) : (
                <div
                  key={seg.objetivo.id}
                  title={seg.objetivo.name}
                  className="flex items-center justify-center text-white text-xs font-semibold py-2 px-1 truncate"
                  style={{ gridColumn: `span ${seg.span}`, backgroundColor: OBJETIVO_COLOR[seg.objetivo.id].bar }}
                >
                  {seg.objetivo.name}
                </div>
              ),
            )}
            {/* Período band: entrega label + date range by extenso, same
               segments as the Objetivos row above (see periodColumnRange). */}
            {objetivoBandSegments.map((seg, i) =>
              seg.kind === 'gap' ? (
                <div key={`per-gap-${i}`} style={{ gridColumn: `span ${seg.span}`, backgroundColor: PERIODO_ROW_BG }} />
              ) : (
                <div
                  key={`per-${seg.objetivo.id}`}
                  title={`${seg.objetivo.entregaLabel} — ${formatObjetivoPeriodLabel(seg.objetivo.periodStart, seg.objetivo.periodEnd)}`}
                  className="flex flex-col items-center justify-center py-1 leading-tight px-1"
                  style={{ gridColumn: `span ${seg.span}`, backgroundColor: PERIODO_ROW_BG, color: '#e2e8f0' }}
                >
                  <span className="text-[10px] font-semibold truncate max-w-full text-white">{seg.objetivo.entregaLabel}</span>
                  <span className="text-[9px] font-normal opacity-90 truncate max-w-full">
                    {formatObjetivoPeriodLabel(seg.objetivo.periodStart, seg.objetivo.periodEnd)}
                  </span>
                </div>
              ),
            )}
            {/* Melhoria 1: month header row, 'day' zoom only — sits above
               the day-number row via CSS Grid auto-placement (the
               "Atividade" corner above spans every header row, so this
               row's cells naturally start at column 2). */}
            {monthGroups.map((g, gi) => (
              <div
                key={g.key}
                title={g.label}
                className={`text-white text-center font-semibold px-1 py-1 text-[10px] uppercase tracking-wide truncate ${
                  gi % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800'
                }`}
                style={{ gridColumn: `span ${g.span}` }}
              >
                {g.label}
              </div>
            ))}
            {/* Meses (mockup item 3): the period covering "hoje" gets a
               lighter background, same idea as the mockup's TODAY_MONTH
               highlight, generalized to whichever zoom level is active. */}
            {periods.map((p, i) => (
              <div
                key={p.key}
                ref={(el) => {
                  periodColRefs.current[i] = el;
                }}
                title={p.start === p.end ? p.start : `${p.start} – ${p.end}`}
                className={`text-white text-center font-mono font-medium px-1 py-1.5 ${
                  i === periods.length - 1 ? 'rounded-tr-md' : ''
                }`}
                style={{ backgroundColor: p.start <= today && today <= p.end ? HEADER_MONTH_TODAY_BG : HEADER_MONTH_BG }}
              >
                {p.label}
              </div>
            ))}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
          <div
            ref={gridRef}
            className="grid text-[11px] min-w-[720px] relative"
            style={{ gridTemplateColumns: `176px repeat(${periods.length}, minmax(${ZOOM_LEVEL_META[zoom].minColWidth}px, 1fr))` }}
          >
            {todayLeft !== null && (
              <div
                aria-hidden="true"
                title="Hoje"
                className="absolute top-0 bottom-0 z-10 pointer-events-none border-l-2 border-dashed border-red-500"
                style={{ left: todayLeft }}
              >
                <span className="absolute -top-0.5 -left-[3px] w-2 h-2 rounded-full bg-red-500" />
                {/* Anchored just inside the scrollable body's own top (not
                   above it, which the overflow-y-auto ancestor would clip)
                   — the header itself no longer scrolls with this line
                   (see the layout-overflow fix), so "Hoje" lives here now. */}
                <span
                  className="sticky top-1 block w-fit whitespace-nowrap text-[10px] font-semibold text-white bg-red-500 rounded-full px-2 py-0.5 shadow-sm"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  Hoje
                </span>
              </div>
            )}
            {/* Melhoria 1: a stronger divider at each month boundary,
               spanning the full height of the (scrollable) body, drawn
               under the "hoje" line and the sticky name column. */}
            {monthDividerLefts.map((left, i) => (
              <div
                key={`month-divider-${i}`}
                aria-hidden="true"
                className="absolute top-0 bottom-0 z-[5] pointer-events-none border-l-2 border-slate-400"
                style={{ left }}
              />
            ))}
            {groups.map((group) => {
              const color = OBJETIVO_COLOR[group.objetivo.id];
              const isCollapsed = collapsed.has(group.objetivo.id);
              const plannedItems = atividades.filter((a) => a.objetivoId === group.objetivo.id && a.kind === 'planned');
              const doneCount = plannedItems.filter((a) => a.status === 'done').length;
              const progress = computeObjetivoProgress(group.objetivo.id, atividades);
              return (
                <div key={group.objetivo.id} className="contents">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group.objetivo.id)}
                    aria-expanded={!isCollapsed}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1 font-semibold border-b text-left cursor-pointer hover:brightness-95 transition-[filter]"
                    style={{ backgroundColor: color.tint, color: color.text, borderColor: color.bar, gridColumn: `span ${periods.length + 1}` }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                      {group.objetivo.name}
                    </span>
                    <span className="text-[10px] font-medium opacity-80 shrink-0">
                      {doneCount}/{plannedItems.length} concluídas — {progress}%
                    </span>
                  </button>
                  {!isCollapsed && group.rows.map(({ atividade, range }) => {
                    rowIndex++;
                    const zebra = rowIndex % 2 === 1;
                    const before = range.startIdx;
                    const after = periods.length - range.startIdx - range.span;
                    const openDetail = () => {
                      clearTimers();
                      setPreview(null);
                      setSelected({ atividade, objetivo: group.objetivo });
                    };
                    const status = timelineVisualStatus(atividade, today);
                    const statusMeta = TIMELINE_STATUS_META[status];
                    const isDone = status === 'done';
                    const fillPercent = computeBarFillPercent(atividade, today);
                    // Estratégia Futura's amber is too light for white text at
                    // WCAG AA (~2.2:1) — every other categoria color is dark
                    // enough that white clears 4.5:1 on both the solid and
                    // faded (30%-alpha) zones of the bar below.
                    const barTextColor = group.objetivo.id === 'estrategia_futura' ? '#78350f' : '#ffffff';
                    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
                      if (isTouch) {
                        handleItemTap(atividade, group.objetivo, e.currentTarget);
                      } else {
                        openDetail();
                      }
                    };
                    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) =>
                      scheduleShow(atividade, group.objetivo, e.currentTarget);
                    return (
                      <div key={atividade.id} className="contents">
                        <div
                          data-hover-item
                          onClick={handleClick}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={scheduleHide}
                          className={`sticky left-0 z-[15] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-b border-slate-100 px-2 py-2.5 cursor-pointer hover:bg-slate-100 flex items-center gap-1.5 min-w-0 transition-colors duration-200 ease-out ${
                            zebra ? 'bg-slate-50' : 'bg-white'
                          } ${
                            isDone
                              ? 'text-slate-900 font-semibold'
                              : status === 'atrasado'
                                ? 'text-red-700 font-medium'
                                : 'text-slate-500'
                          }`}
                          title={`${group.objetivo.entregaLabel} — ${atividade.name} (${statusMeta.label}) — clique para detalhes`}
                        >
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: status === 'planned' ? '#ffffff' : statusMeta.bg,
                              border: status === 'planned' ? `1.5px solid ${statusMeta.border}` : 'none',
                            }}
                          />
                          {isDone && (
                            <span aria-hidden="true" className="text-emerald-600 shrink-0">
                              ✓
                            </span>
                          )}
                          {status === 'atrasado' && (
                            <span aria-hidden="true" className="shrink-0">
                              ⚠
                            </span>
                          )}
                          <span className="flex-1 min-w-0 truncate">{atividade.name}</span>
                          {atividade.kind === 'extra' && (
                            <span className="text-[8px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1 py-0.5 shrink-0">
                              Extra
                            </span>
                          )}
                        </div>
                        {before > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${before}` }}
                          />
                        )}
                        <div
                          className={`border-b border-l border-slate-100 relative py-0.5 ${zebra ? 'bg-slate-50/60' : ''}`}
                          style={{ gridColumn: `span ${range.span}` }}
                        >
                          {/* Categoria color drives the fill now, not status:
                             solid up to fillPercent (% of the planned time
                             already elapsed — computeBarFillPercent, the
                             same value the old bottom strip used), the same
                             hue at 30% alpha for the remainder — a hard-edge
                             two-stop gradient (equal-position stops), not a
                             blend, so the boundary itself reads as "done vs.
                             remaining". Status still shows via the ✓/⚠ icons
                             and the row's name-cell dot/text color. */}
                          <button
                            type="button"
                            data-hover-item
                            onClick={handleClick}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={scheduleHide}
                            className={`absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center gap-1 px-1.5 text-[10px] font-semibold cursor-pointer hover:brightness-110 hover:ring-2 hover:ring-black/10 transition-all duration-200 ease-out ${
                              isDone ? 'ring-1 ring-white/60 shadow-sm' : ''
                            }`}
                            style={{
                              background: `linear-gradient(to right, ${color.bar} 0%, ${color.bar} ${fillPercent}%, ${color.bar}4d ${fillPercent}%, ${color.bar}4d 100%)`,
                              color: barTextColor,
                              // The faded (30%-alpha) zone is pale enough that
                              // plain white text loses contrast there — a dark
                              // halo keeps the name legible no matter where the
                              // solid/faded boundary falls, without needing a
                              // second text color per zone. Skipped for
                              // Estratégia Futura, which already uses dark text
                              // (safe on both zones since its faded tint is
                              // still light).
                              textShadow: barTextColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.6)' : undefined,
                            }}
                          >
                            {isDone && <span aria-hidden="true">✓</span>}
                            {status === 'atrasado' && <span aria-hidden="true">⚠</span>}
                            <span className="flex-1 min-w-0 truncate">{atividade.name}</span>
                            <span className="shrink-0 opacity-90 font-mono">{fillPercent}%</span>
                          </button>
                        </div>
                        {after > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${after}` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Melhoria 2: "Atividades da Semana" — the report's
               free-narrative Projetos/Iniciativas, not governed roadmap
               data. Most have no plannedStart/plannedEnd of their own, so
               they're placed as a single-day point (diamond marker) at the
               report's own weekStart rather than a bar, since a date RANGE
               would otherwise be fabricated data; an item that DOES set a
               prazo (Melhoria 2.1) gets a normal range bar instead.
               Visually distinguished with the purple "Manual" badge/color
               already used elsewhere in the app for ad-hoc items. */}
            {manualRows.length > 0 && (
              <div className="contents">
                <button
                  type="button"
                  onClick={() => setManualCollapsed((v) => !v)}
                  aria-expanded={!manualCollapsed}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 font-semibold border-b text-left cursor-pointer hover:brightness-95 transition-[filter]"
                  style={{
                    backgroundColor: MANUAL_GROUP_COLOR.tint,
                    color: MANUAL_GROUP_COLOR.text,
                    borderColor: MANUAL_GROUP_COLOR.bar,
                    gridColumn: `span ${periods.length + 1}`,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true">{manualCollapsed ? '▸' : '▾'}</span>
                    Atividades da Semana
                    <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(narrativa livre)</span>
                  </span>
                </button>
                {!manualCollapsed &&
                  manualRows.map(({ project, weekStart, range, hasOwnDates }) => {
                    rowIndex++;
                    const zebra = rowIndex % 2 === 1;
                    const before = range.startIdx;
                    const after = periods.length - range.startIdx - range.span;
                    const meta = STATUS_META[project.status];
                    const projectName = project.name || 'Projeto sem nome';
                    const dateLabel = hasOwnDates
                      ? `${project.plannedStart} – ${project.plannedEnd}`
                      : `sem prazo definido — marcador na semana de ${weekStart}`;
                    return (
                      <div key={project.id} className="contents">
                        <div
                          className={`sticky left-0 z-[15] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-b border-slate-100 px-2 py-2.5 flex items-center gap-1.5 min-w-0 text-slate-600 ${
                            zebra ? 'bg-slate-50' : 'bg-white'
                          }`}
                          title={`${projectName} — ${meta.label} (${dateLabel})`}
                        >
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rotate-45 rounded-[1px] shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="flex-1 min-w-0 truncate">{projectName}</span>
                          <span className="text-[8px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1 py-0.5 shrink-0">
                            Manual
                          </span>
                          <span
                            className="text-[9px] font-semibold rounded px-1.5 py-0.5 shrink-0"
                            style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        {before > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${before}` }}
                          />
                        )}
                        <div
                          className={`border-b border-l border-slate-100 relative py-0.5 ${zebra ? 'bg-slate-50/60' : ''}`}
                          style={{ gridColumn: `span ${range.span}` }}
                        >
                          {hasOwnDates ? (
                            <div
                              title={`${projectName} — ${meta.label} (${dateLabel})`}
                              className="absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center gap-1 px-1.5 text-[10px] font-semibold text-white"
                              style={{ backgroundColor: meta.color }}
                            >
                              <span className="flex-1 min-w-0 truncate">{projectName}</span>
                              <div
                                aria-hidden="true"
                                className="absolute left-0 right-0 bottom-0 h-[3px] rounded-b bg-black/15 overflow-hidden"
                              >
                                <div className="h-full bg-white/70" style={{ width: `${project.percent}%` }} />
                              </div>
                            </div>
                          ) : (
                            <div
                              aria-hidden="true"
                              title={`${projectName} — ${meta.label} (${dateLabel})`}
                              className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
                              style={{ backgroundColor: meta.color }}
                            />
                          )}
                        </div>
                        {after > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${after}` }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {/* Backlog band: items not yet part of the governed roadmap —
               visually distinct (neutral gray, "BACKLOG" badge) from both the
               Objetivo groups above and the purple "Atividades da Semana"
               group. Always a single point marker at estimatedDueDate (or
               createdAt, when no prazo was set), never a range bar — a
               backlog item has only one date field of its own, so a start/
               end range would be fabricated data. */}
            {backlogRows.length > 0 && (
              <div className="contents">
                <button
                  type="button"
                  onClick={() => setBacklogCollapsed((v) => !v)}
                  aria-expanded={!backlogCollapsed}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 font-semibold border-b text-left cursor-pointer hover:brightness-95 transition-[filter]"
                  style={{
                    backgroundColor: BACKLOG_GROUP_COLOR.tint,
                    color: BACKLOG_GROUP_COLOR.text,
                    borderColor: BACKLOG_GROUP_COLOR.bar,
                    gridColumn: `span ${periods.length + 1}`,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true">{backlogCollapsed ? '▸' : '▾'}</span>
                    Backlog
                    <span className="text-[10px] font-normal opacity-70 hidden sm:inline">(ainda não planejado)</span>
                  </span>
                </button>
                {!backlogCollapsed &&
                  backlogRows.map(({ item, pointDate, range }) => {
                    rowIndex++;
                    const zebra = rowIndex % 2 === 1;
                    const before = range.startIdx;
                    const after = periods.length - range.startIdx - range.span;
                    const priorityMeta = BACKLOG_PRIORITY_META[item.priority];
                    const statusMeta = BACKLOG_STATUS_META[item.status];
                    const objetivo = item.objetivoId ? objetivos.find((o) => o.id === item.objetivoId) : null;
                    const itemName = item.name || 'Item de backlog sem nome';
                    const dateLabel = item.estimatedDueDate ? `prazo estimado: ${pointDate}` : `sem prazo — criado em ${pointDate}`;
                    return (
                      <div key={item.id} className="contents">
                        <div
                          className={`sticky left-0 z-[15] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] border-b border-slate-100 px-2 py-2.5 flex items-center gap-1.5 min-w-0 text-slate-600 ${
                            zebra ? 'bg-slate-50' : 'bg-white'
                          }`}
                          title={`${itemName} — ${priorityMeta.label} / ${statusMeta.label} (${dateLabel})`}
                        >
                          <span
                            aria-hidden="true"
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: objetivo ? OBJETIVO_COLOR[objetivo.id].bar : BACKLOG_GROUP_COLOR.bar }}
                          />
                          <span className="flex-1 min-w-0 truncate">{itemName}</span>
                          <span className="text-[8px] font-bold uppercase tracking-wide bg-slate-200 text-slate-600 rounded px-1 py-0.5 shrink-0">
                            Backlog
                          </span>
                          <span
                            className="text-[9px] font-semibold rounded px-1.5 py-0.5 shrink-0"
                            style={{ backgroundColor: `${statusMeta.color}1a`, color: statusMeta.color }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        {before > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${before}` }}
                          />
                        )}
                        <div
                          className={`border-b border-l border-slate-100 relative py-0.5 ${zebra ? 'bg-slate-50/60' : ''}`}
                          style={{ gridColumn: `span ${range.span}` }}
                        >
                          <div
                            aria-hidden="true"
                            title={`${itemName} — ${priorityMeta.label} / ${statusMeta.label} (${dateLabel})`}
                            className="absolute top-1/2 left-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                            style={{ backgroundColor: priorityMeta.color }}
                          />
                        </div>
                        {after > 0 && (
                          <div
                            className={`border-b border-l border-slate-100 ${zebra ? 'bg-slate-50/60' : ''}`}
                            style={{ gridColumn: `span ${after}` }}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          </div>
        </div>
          )}
        </div>
      )}
      {/* Legenda combinada (mockup item 6): pontos de Objetivo + status da
         Timeline numa única faixa, em vez de blocos separados. */}
      {hasAnyVisibleGroup && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-100 text-[11px] shrink-0">
          {objetivos.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: OBJETIVO_COLOR[o.id].bar }} />
              {o.name}
            </span>
          ))}
          <span className="w-px h-4 bg-slate-200 hidden sm:block" />
          {(Object.keys(TIMELINE_STATUS_META) as TimelineVisualStatus[]).map((s) => {
            const meta = TIMELINE_STATUS_META[s];
            return (
              <span key={s} className="inline-flex items-center gap-1.5 font-medium" style={{ color: meta.bg }}>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s === 'planned' ? '#ffffff' : meta.bg, border: `1.5px solid ${meta.border ?? meta.bg}` }}
                />
                {meta.label}
              </span>
            );
          })}
        </div>
      )}
      </div>
      {selected && (
        <ActivityDetailPanel
          atividade={selected.atividade}
          objetivo={selected.objetivo}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onEditInEditor={() => {
            onEditAtividade(selected.objetivo.id, selected.atividade.id);
            setSelected(null);
          }}
          onSave={async (patch) => {
            await onUpdateAtividade(selected.atividade.id, patch);
            setSelected(null);
          }}
        />
      )}
      {preview && !selected && (
        <HoverPreviewCard
          atividade={preview.atividade}
          objetivo={preview.objetivo}
          anchorRect={preview.anchorRect}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onOpen={() => {
            clearTimers();
            setPreview(null);
            setSelected({ atividade: preview.atividade, objetivo: preview.objetivo });
          }}
        />
      )}
      {showNewActivity && (
        <NewActivityModal
          objetivos={objetivos}
          defaultObjetivoId={objetivos[0].id}
          onClose={() => setShowNewActivity(false)}
          onCreate={async (objetivoId, name, plannedStart, plannedEnd) => {
            await onCreateAtividade(objetivoId, name, plannedStart, plannedEnd);
            setShowNewActivity(false);
          }}
        />
      )}
    </section>
  );
}
