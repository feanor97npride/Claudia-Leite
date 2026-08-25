import type { ProjectStatus, Report } from '../../types';
import { STATUS_META } from '../../types';
import { formatShortDate } from '../../utils/date';

interface Props {
  reports: Report[];
  activeReportId: string | null;
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

export default function HistoryPanel({ reports, activeReportId, onView, onDuplicate, onDelete }: Props) {
  if (reports.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-10 border border-dashed border-slate-200 rounded-xl">
        Nenhum relatório salvo ainda.
        <br />
        Gere seu primeiro snapshot para começar o histórico.
      </div>
    );
  }

  return (
    <ol className="relative border-l border-slate-200 ml-2 space-y-4">
      {reports.map((r) => {
        const status = worstStatus(r);
        const active = r.id === activeReportId;
        return (
          <li key={r.id} className="ml-4">
            <span
              className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: status ? STATUS_META[status].color : '#cbd5e1' }}
            />
            <div
              className={`rounded-xl border p-3 transition-colors ${
                active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.periodLabel}</p>
                  <p className="text-[11px] text-slate-400">
                    {formatShortDate(r.weekStart)} · {r.projects.length}{' '}
                    {r.projects.length === 1 ? 'atividade' : 'atividades'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
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
                <button
                  onClick={() => {
                    if (confirm('Excluir este relatório do histórico?')) onDelete(r);
                  }}
                  className="text-[11px] font-medium px-2 py-1 rounded-md text-red-500 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
