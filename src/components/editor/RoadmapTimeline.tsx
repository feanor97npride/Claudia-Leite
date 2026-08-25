import { useEffect, useRef, useState } from 'react';
import type { Atividade, Objetivo, ObjetivoId } from '../../types';
import { OBJETIVO_COLOR } from '../../types';
import { atividadesForObjetivo, isVisibleThisWeek, monthColumnRange } from '../../lib/roadmap';
import { monthKeyLabel, monthsBetween } from '../../utils/date';
import AtividadeDetailModal from './AtividadeDetailModal';
import HoverPreviewCard from './HoverPreviewCard';

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  currentWeekStart: string;
  readOnly: boolean;
  onEditAtividade: (objetivoId: ObjetivoId, atividadeId: string) => void;
}

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
export default function RoadmapTimeline({ objetivos, atividades, currentWeekStart, readOnly, onEditAtividade }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selected, setSelected] = useState<{ atividade: Atividade; objetivo: Objetivo } | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }

  if (objetivos.length === 0) return null;

  const rangeStart = objetivos.reduce((min, o) => (o.periodStart < min ? o.periodStart : min), objetivos[0].periodStart);
  const rangeEnd = objetivos.reduce((max, o) => (o.periodEnd > max ? o.periodEnd : max), objetivos[0].periodEnd);
  const months = monthsBetween(rangeStart, rangeEnd);

  const groups = objetivos
    .map((objetivo) => ({
      objetivo,
      rows: atividadesForObjetivo(objetivo.id, atividades)
        .filter((a) => isVisibleThisWeek(a, currentWeekStart))
        .filter((a): a is Atividade & { plannedStart: string; plannedEnd: string } => !!a.plannedStart && !!a.plannedEnd)
        .map((atividade) => ({
          atividade,
          range: monthColumnRange(atividade.plannedStart, atividade.plannedEnd, months),
        }))
        .filter((row): row is typeof row & { range: { startIdx: number; span: number } } => row.range !== null),
    }))
    .filter((group) => group.rows.length > 0);

  const rows = groups.flatMap((group) => group.rows.map((row) => ({ objetivo: group.objetivo, ...row })));

  return (
    <section
      ref={containerRef}
      className={
        isFullscreen
          ? 'bg-white p-6 h-full overflow-auto'
          : 'rounded-xl border border-slate-200 bg-white p-4'
      }
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roadmap — Visão Timeline</h2>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          title={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Expandir para tela cheia'}
          className="text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors shrink-0"
        >
          {isFullscreen ? '⤡ Sair da tela cheia' : '⤢ Tela cheia'}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Nenhuma atividade com início e fim planejados definidos ainda — defina o "Prazo" de uma
          atividade no Roadmap acima (modo de edição de um Objetivo) para ela aparecer aqui.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid text-[11px] min-w-[720px]"
            style={{ gridTemplateColumns: `176px repeat(${months.length}, minmax(56px, 1fr))` }}
          >
            <div className="bg-slate-900 text-white font-semibold px-2 py-1.5 rounded-tl-md">Atividade</div>
            {months.map((m, i) => (
              <div
                key={m}
                className={`bg-slate-800 text-white text-center font-mono font-medium px-1 py-1.5 ${
                  i === months.length - 1 ? 'rounded-tr-md' : ''
                }`}
              >
                {monthKeyLabel(m)}
              </div>
            ))}
            {groups.map((group) => {
              const color = OBJETIVO_COLOR[group.objetivo.id];
              return (
                <div key={group.objetivo.id} className="contents">
                  <div
                    className="px-2 py-1 font-semibold border-b"
                    style={{ backgroundColor: color.tint, color: color.text, borderColor: color.bar, gridColumn: `span ${months.length + 1}` }}
                  >
                    {group.objetivo.name}
                  </div>
                  {group.rows.map(({ atividade, range }) => {
                    const before = range.startIdx;
                    const after = months.length - range.startIdx - range.span;
                    const openDetail = () => {
                      clearTimers();
                      setPreview(null);
                      setSelected({ atividade, objetivo: group.objetivo });
                    };
                    const isDone = atividade.status === 'done';
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
                          className={`border-b border-slate-100 px-2 py-1.5 cursor-pointer hover:bg-slate-50 flex items-center gap-1 min-w-0 transition-colors duration-200 ease-out ${
                            isDone ? 'text-slate-900 font-semibold' : 'text-slate-500'
                          }`}
                          title={`${group.objetivo.entregaLabel} — ${atividade.name} (clique para detalhes)`}
                        >
                          {isDone && (
                            <span aria-hidden="true" className="text-emerald-600 shrink-0">
                              ✓
                            </span>
                          )}
                          <span className="truncate">{atividade.name}</span>
                          {atividade.kind === 'extra' && (
                            <span className="text-[8px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1 py-0.5 shrink-0">
                              Extra
                            </span>
                          )}
                        </div>
                        {before > 0 && (
                          <div className="border-b border-l border-slate-100" style={{ gridColumn: `span ${before}` }} />
                        )}
                        <div
                          className="border-b border-l border-slate-100 relative py-0.5"
                          style={{ gridColumn: `span ${range.span}` }}
                        >
                          {/* Done: full-strength objetivo color (bar) + a check for
                             reinforcement. Not done: the same objetivo's lighter
                             "tint" background with its own dark "text" color — a
                             real color swap, not an opacity/grayscale filter, so
                             the WCAG AA contrast of the label doesn't get diluted
                             by compositing toward the page background (opacity
                             scales down foreground/background contrast together;
                             tint+text was already designed as a legible pair). */}
                          <button
                            type="button"
                            data-hover-item
                            onClick={handleClick}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={scheduleHide}
                            className={`absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center gap-1 px-1.5 text-[10px] font-semibold truncate hover:brightness-110 transition-colors duration-200 ease-out ${
                              isDone ? 'ring-1 ring-white/60 shadow-sm' : ''
                            }`}
                            style={{
                              backgroundColor: isDone ? color.bar : color.tint,
                              color: isDone ? '#ffffff' : color.text,
                            }}
                          >
                            {isDone && <span aria-hidden="true">✓</span>}
                            <span className="truncate">{atividade.name}</span>
                          </button>
                        </div>
                        {after > 0 && (
                          <div className="border-b border-l border-slate-100" style={{ gridColumn: `span ${after}` }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
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
