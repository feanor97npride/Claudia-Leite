import { useEffect, useState } from 'react';
import type { Atividade, Objetivo, ProjectStatus, Report } from '../../types';
import { STATUS_META } from '../../types';
import { formatShortDate } from '../../utils/date';
import { reportRoadmapAtividadesCount } from '../../lib/roadmap';

interface Props {
  reports: Report[];
  activeReportId: string | null;
  atividades: Atividade[];
  objetivos: Objetivo[];
  onView: (report: Report) => void;
  onDuplicate: (report: Report) => void;
  onDelete: (report: Report) => void;
}

function worstStatus(report: Report): ProjectStatus | null {
  if (report.projects.length === 0) return null;
  if (report.projects.some((p) => p.status === 'delayed')) return 'delayed';
  if (report.projects.some((p) => p.status === 'attention')) return 'attention';
  return 'on_track';
}

export default function HistoryPanel({ reports, activeReportId, atividades, objetivos, onView, onDuplicate, onDelete }: Props) {
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  // Close the context menu on any click outside it — same outside-tap
  // pattern used elsewhere (e.g. the Roadmap Timeline's touch preview).
  useEffect(() => {
    if (!openMenuFor) return;
    function handleOutside() {
      setOpenMenuFor(null);
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [openMenuFor]);

  if (reports.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-10 border border-dashed border-slate-200 rounded-xl">
        Nenhum relatório salvo ainda.
        <br />
        Gere seu primeiro snapshot para começar o histórico.
      </div>
    );
  }

  // The most recent report (list is already sorted newest-first by App.tsx)
  // is "o atual" — distinct from `active` (whichever one is open in the
  // Editor/Snapshot right now, which the user can navigate away from).
  const currentReportId = reports[0]?.id ?? null;

  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-4">
      {reports.map((r) => {
        const status = worstStatus(r);
        const active = r.id === activeReportId;
        const isCurrent = r.id === currentReportId;
        const menuOpen = openMenuFor === r.id;
        return (
          <li key={r.id} className="ml-4">
            <span
              className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: status ? STATUS_META[status].color : '#cbd5e1' }}
            />
            <div
              className={`relative rounded-xl border p-3 transition-colors ${
                isCurrent
                  ? 'border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/30'
                  : active
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 shrink-0">
                      Atual
                    </span>
                  )}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuFor((cur) => (cur === r.id ? null : r.id));
                    }}
                    aria-label="Mais ações"
                    aria-expanded={menuOpen}
                    className="text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded px-1.5 py-0.5 transition-colors leading-none"
                  >
                    ⋮
                  </button>
                  {menuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      role="menu"
                      className="absolute right-0 top-full mt-1 z-10 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuFor(null);
                          if (confirm('Excluir este relatório do histórico?')) onDelete(r);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-900 leading-snug mb-0.5">{r.periodLabel}</p>
              <p className="text-xs text-slate-400 mb-3">
                {formatShortDate(r.weekStart)} · {r.projects.length} {r.projects.length === 1 ? 'entrega' : 'entregas'} ·{' '}
                {reportRoadmapAtividadesCount(r, atividades, objetivos)} atividades
              </p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => onView(r)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800"
                >
                  Visualizar
                </button>
                <button
                  onClick={() => onDuplicate(r)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Duplicar p/ próx. semana
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
