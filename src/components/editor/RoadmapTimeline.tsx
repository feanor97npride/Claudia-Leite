import { useEffect, useRef, useState } from 'react';
import type { Atividade, Objetivo, ObjetivoId, Project, TimelineVisualStatus } from '../../types';
import { OBJETIVO_COLOR, STATUS_META, TIMELINE_STATUS_META } from '../../types';
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
import { todayISO } from '../../utils/date';
import AtividadeDetailModal from './AtividadeDetailModal';
import HoverPreviewCard from './HoverPreviewCard';

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
  /** Real "today" Monday (ISO), independent of any report selected in
   *  History (Melhoria 2.2) — the Roadmap's own time anchor, used for the
   *  "hoje" line and to decide which still-open extras count as current. */
  currentWeekStart: string;
  readOnly: boolean;
  onEditAtividade: (objetivoId: ObjetivoId, atividadeId: string) => void;
}

/** Not a real ObjetivoId — a manual color token for the synthetic
 *  "Atividades da Semana" group, purple to match the "Extra" badge already
 *  used elsewhere for ad-hoc (non-governed) items. */
const MANUAL_GROUP_COLOR = { tint: '#faf5ff', text: '#7e22ce', bar: '#a855f7' };

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
  currentWeekStart,
  readOnly,
  onEditAtividade,
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
  const [categoriaFilter, setCategoriaFilter] = useState<Set<ObjetivoId>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<TimelineVisualStatus>>(new Set());
  const [responsavelFilter, setResponsavelFilter] = useState<Set<string>>(new Set());
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
  const hasAnyVisibleGroup = groups.length > 0 || manualRows.length > 0;

  // Zebra striping index — a plain counter (not state) incremented in
  // render order as rows are mapped below, so alternating rows read
  // consistently regardless of which groups are collapsed/filtered out.
  let rowIndex = -1;

  return (
    <section
      ref={containerRef}
      className={
        isFullscreen
          ? 'bg-white p-6 h-full overflow-hidden flex flex-col'
          : 'rounded-xl border border-slate-200 bg-white p-4 flex flex-col max-h-[75vh]'
      }
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roadmap — Visão Timeline</h2>
        <div className="flex items-center gap-2 shrink-0">
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
      {eligibleRows.length === 0 && manualEligibleRows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Nenhuma atividade com início e fim planejados definidos ainda — defina o "Prazo" de uma
          atividade no Roadmap acima (modo de edição de um Objetivo) para ela aparecer aqui.
        </p>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
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
              className="sticky left-0 z-20 bg-slate-900 text-white font-semibold px-2 py-1.5 rounded-tl-md shadow-[3px_0_6px_-2px_rgba(0,0,0,0.35)]"
              style={{ gridRow: monthGroups.length > 0 ? 'span 2' : undefined }}
            >
              Atividade
            </div>
            {/* Melhoria 1: month header row, 'day' zoom only — sits above
               the day-number row via CSS Grid auto-placement (the
               "Atividade" corner above spans both rows, so this row's
               cells naturally start at column 2). */}
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
            {periods.map((p, i) => (
              <div
                key={p.key}
                ref={(el) => {
                  periodColRefs.current[i] = el;
                }}
                title={p.start === p.end ? p.start : `${p.start} – ${p.end}`}
                className={`bg-slate-800 text-white text-center font-mono font-medium px-1 py-1.5 ${
                  i === periods.length - 1 ? 'rounded-tr-md' : ''
                }`}
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
                          {/* Status-based palette (TIMELINE_STATUS_META), not the
                             objetivo color — grouping is already carried by the
                             colored header row above, so the bar itself is free
                             to encode status (the thing this Timeline redesign's
                             Fase 1 asked to make legible at a glance): solid
                             green/blue/red fills with white text, and a pale
                             outline for "não iniciado" — every pair checked by
                             hand for WCAG AA (>=4.5:1), never an opacity/
                             grayscale dim (see the visual-hierarchy note in
                             types.ts — that dilutes contrast, a real color swap
                             doesn't). */}
                          <button
                            type="button"
                            data-hover-item
                            onClick={handleClick}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={scheduleHide}
                            className={`absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center gap-1 px-1.5 text-[10px] font-semibold cursor-pointer hover:brightness-110 hover:ring-2 hover:ring-black/10 transition-all duration-200 ease-out ${
                              isDone ? 'ring-1 ring-white/60 shadow-sm' : ''
                            } ${status === 'planned' ? 'border-2' : ''}`}
                            style={{
                              backgroundColor: statusMeta.bg,
                              color: statusMeta.text,
                              borderColor: statusMeta.border,
                              backgroundImage: statusMeta.pattern
                                ? 'repeating-linear-gradient(135deg, rgba(255,255,255,0.15) 0 6px, transparent 6px 12px)'
                                : undefined,
                            }}
                          >
                            {isDone && <span aria-hidden="true">✓</span>}
                            {status === 'atrasado' && <span aria-hidden="true">⚠</span>}
                            <span className="flex-1 min-w-0 truncate">{atividade.name}</span>
                            {/* % do prazo planejado já decorrido (proxy de progresso —
                               não há um campo de "% concluído" por atividade; ver
                               computeBarFillPercent). Tira fina no rodapé da barra,
                               fora da linha do texto, então nunca reduz o contraste
                               do rótulo. */}
                            <div
                              aria-hidden="true"
                              className="absolute left-0 right-0 bottom-0 h-[3px] rounded-b bg-black/15 overflow-hidden"
                            >
                              <div className="h-full bg-white/70" style={{ width: `${fillPercent}%` }} />
                            </div>
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
          </div>
          </div>
        </div>
          )}
        </div>
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
      {selected && (
        <AtividadeDetailModal
          atividade={selected.atividade}
          objetivo={selected.objetivo}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
          onEdit={() => {
            onEditAtividade(selected.objetivo.id, selected.atividade.id);
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
