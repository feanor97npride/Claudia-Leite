import { useEffect, useRef, useState } from 'react';
import type { Atividade, Objetivo, ObjetivoId } from '../../types';
import { OBJETIVO_COLOR } from '../../types';
import { atividadesForObjetivo, isVisibleThisWeek, monthColumnRange } from '../../lib/roadmap';
import { monthKeyLabel, monthsBetween } from '../../utils/date';
import AtividadeDetailModal from './AtividadeDetailModal';

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  currentWeekStart: string;
  readOnly: boolean;
  onEditAtividade: (objetivoId: ObjetivoId, atividadeId: string) => void;
}

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

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
                    const openDetail = () => setSelected({ atividade, objetivo: group.objetivo });
                    return (
                      <div key={atividade.id} className="contents">
                        <div
                          onClick={openDetail}
                          className="border-b border-slate-100 px-2 py-1.5 text-slate-600 cursor-pointer hover:bg-slate-50 flex items-center gap-1 min-w-0"
                          title={`${group.objetivo.entregaLabel} — ${atividade.name} (clique para detalhes)`}
                        >
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
                          <button
                            type="button"
                            onClick={openDetail}
                            className="absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center px-1.5 text-white text-[10px] font-semibold truncate hover:brightness-110 transition-[filter]"
                            style={{ backgroundColor: color.bar }}
                          >
                            {atividade.name}
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
