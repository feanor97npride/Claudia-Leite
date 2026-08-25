import type { Atividade, Objetivo } from '../../types';
import { OBJETIVO_COLOR } from '../../types';
import { atividadesForObjetivo, isVisibleThisWeek, monthColumnRange } from '../../lib/roadmap';
import { monthKeyLabel, monthsBetween } from '../../utils/date';

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  currentWeekStart: string;
}

/**
 * Bloco de referência: um Gantt gerado ao vivo a partir dos períodos dos
 * Objetivos e das datas planejadas das Atividades — a "visão de linha de
 * base" que o roadmap original propôs, sempre em sincronia com o dado real
 * (ao contrário de uma imagem estática, nunca fica desatualizado). Só
 * atividades com início E fim planejados definidos entram no gráfico —
 * sem inventar datas para o que ainda não foi planejado.
 */
export default function RoadmapTimeline({ objetivos, atividades, currentWeekStart }: Props) {
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
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Roadmap — Visão Timeline</h2>
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
                    return (
                      <div key={atividade.id} className="contents">
                        <div
                          className="border-b border-slate-100 px-2 py-1.5 text-slate-600 truncate"
                          title={`${group.objetivo.entregaLabel} — ${atividade.name}`}
                        >
                          {atividade.name}
                        </div>
                        {before > 0 && (
                          <div className="border-b border-l border-slate-100" style={{ gridColumn: `span ${before}` }} />
                        )}
                        <div
                          className="border-b border-l border-slate-100 relative py-0.5"
                          style={{ gridColumn: `span ${range.span}` }}
                        >
                          <div
                            className="absolute inset-y-1 left-0.5 right-0.5 rounded flex items-center px-1.5 text-white text-[10px] font-semibold truncate"
                            style={{ backgroundColor: color.bar }}
                          >
                            {atividade.name}
                          </div>
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
    </section>
  );
}
