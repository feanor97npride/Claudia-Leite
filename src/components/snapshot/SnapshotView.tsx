import { forwardRef } from 'react';
import type { Report } from '../../types';
import StatusBadge from './StatusBadge';
import { STATUS_META } from '../../types';

interface Props {
  report: Report;
}

function renderLines(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return <p className="text-slate-400 italic">—</p>;
  }
  return (
    <ul className="space-y-0.5 list-disc list-inside marker:text-current">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

const SnapshotView = forwardRef<HTMLDivElement, Props>(({ report }, ref) => {
  const twoCol = report.projects.length > 2;
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(report.updatedAt));

  return (
    <div
      ref={ref}
      className="snapshot-page bg-white mx-auto shadow-xl border border-slate-200 p-8 text-slate-800 flex flex-col"
      style={{ fontSize: '12px' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">{report.area || 'Sistemas (TI)'}</h1>
          <p className="text-slate-500 text-xs">Status Report Semanal</p>
        </div>
        <div className="text-right text-xs text-slate-600">
          <p className="font-semibold text-slate-900">{report.periodLabel}</p>
          <p>Responsável: {report.responsible || '—'}</p>
        </div>
      </div>

      {/* Exec summary */}
      {report.execSummary.trim() && (
        <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs leading-relaxed text-slate-700 italic">
          {report.execSummary}
        </div>
      )}

      {/* Projects - primary focus */}
      <div className={`grid gap-2.5 ${twoCol ? 'grid-cols-2' : 'grid-cols-1'} mb-3`}>
        {report.projects.map((p) => (
          <div key={p.id} className="rounded-lg border border-slate-300 overflow-hidden break-inside-avoid">
            <div className="flex items-center justify-between gap-2 bg-slate-900 text-white px-2.5 py-1.5">
              <span className="font-semibold text-xs truncate">{p.name || 'Projeto sem nome'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-slate-300">{p.percent}%</span>
                <StatusBadge status={p.status} />
              </div>
            </div>
            <div className="h-1 bg-slate-100">
              <div
                className="h-full"
                style={{ width: `${p.percent}%`, backgroundColor: STATUS_META[p.status].color }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 p-2 bg-white">
              <div className="rounded-md bg-emerald-50 border border-emerald-300 p-1.5">
                <p className="text-[10px] font-bold text-emerald-800 mb-0.5 uppercase tracking-wide">
                  ✓ Entregas da semana
                </p>
                <div className="text-[11px] text-emerald-900 leading-snug">{renderLines(p.deliveries)}</div>
              </div>
              <div className="rounded-md bg-sky-50 border border-sky-300 p-1.5">
                <p className="text-[10px] font-bold text-sky-800 mb-0.5 uppercase tracking-wide">
                  → Avanços p/ próx. semana
                </p>
                <div className="text-[11px] text-sky-900 leading-snug">{renderLines(p.nextWeekAdvances)}</div>
              </div>
            </div>

            {(p.nextSteps.trim() || p.risks.trim()) && (
              <div className="grid grid-cols-2 gap-2 px-2 pb-2 text-[10px] text-slate-500">
                <div>
                  <span className="font-semibold text-slate-500">Próximos passos: </span>
                  {p.nextSteps.trim() || '—'}
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Riscos/bloqueios: </span>
                  <span className={p.risks.trim() ? 'text-red-600 font-medium' : ''}>{p.risks.trim() || '—'}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Secondary: indicators + highlights/attention */}
      <div className={`grid gap-2.5 text-[10px] ${report.indicators.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {report.indicators.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Indicadores gerais</p>
            <div className="flex flex-wrap gap-1.5">
              {report.indicators.map((ind) => (
                <span key={ind.id} className="rounded bg-white border border-slate-200 px-1.5 py-0.5">
                  <span className="text-slate-500">{ind.label}: </span>
                  <span className="font-semibold text-slate-800">{ind.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Destaques da semana</p>
          <div className="text-slate-700 leading-snug">{renderLines(report.highlights)}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="font-semibold text-amber-700 uppercase tracking-wide mb-1">Pontos de atenção</p>
          <div className="text-amber-900 leading-snug">{renderLines(report.attentionPoints)}</div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 text-[9px] text-slate-400 flex justify-between">
        <span>Gerado em {generatedAt}</span>
        <span>Status Report App</span>
      </div>
    </div>
  );
});

SnapshotView.displayName = 'SnapshotView';

export default SnapshotView;
