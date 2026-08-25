import { useEffect } from 'react';
import type { Atividade, Objetivo } from '../../types';
import { TIMELINE_STATUS_META } from '../../types';
import { timelineVisualStatus } from '../../lib/roadmap';
import { formatShortDate, todayISO } from '../../utils/date';

interface Props {
  atividade: Atividade;
  objetivo: Objetivo;
  readOnly: boolean;
  onEdit: () => void;
  onClose: () => void;
}

/** Detail popover shown when clicking an activity bar in the Roadmap
 *  Timeline — read-only summary plus a shortcut into the governed Editor,
 *  since the Timeline itself isn't an editing surface. */
export default function AtividadeDetailModal({ atividade, objetivo, readOnly, onEdit, onClose }: Props) {
  const status = timelineVisualStatus(atividade, todayISO());
  const statusMeta = TIMELINE_STATUS_META[status];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={atividade.name || 'Atividade'}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold text-slate-900">{atividade.name || 'Atividade sem nome'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-900 text-lg leading-none px-1 shrink-0"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          {objetivo.entregaLabel} — {objetivo.name}
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide rounded px-2 py-1 ${
              status === 'planned' ? 'border' : ''
            }`}
            style={{ backgroundColor: statusMeta.bg, color: statusMeta.text, borderColor: statusMeta.border }}
          >
            {statusMeta.label}
          </span>
          {atividade.kind === 'extra' && (
            <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-2 py-1">
              Extra
            </span>
          )}
        </div>

        <dl className="space-y-2 text-sm mb-4">
          {atividade.plannedStart && atividade.plannedEnd && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Prazo planejado</dt>
              <dd className="text-slate-700 font-medium">
                {formatShortDate(atividade.plannedStart)} — {formatShortDate(atividade.plannedEnd)}
              </dd>
            </div>
          )}
          {atividade.completedAt && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Concluída em</dt>
              <dd className="text-slate-700 font-medium">{formatShortDate(atividade.completedAt)}</dd>
            </div>
          )}
          {atividade.raciAccountableName?.trim() && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Responsável</dt>
              <dd className="text-slate-700 font-medium">{atividade.raciAccountableName}</dd>
            </div>
          )}
          {atividade.raciResponsibleName?.trim() && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-400">Executor</dt>
              <dd className="text-slate-700 font-medium">{atividade.raciResponsibleName}</dd>
            </div>
          )}
        </dl>

        {atividade.note?.trim() && (
          <p className="text-xs text-slate-500 italic bg-slate-50 rounded-lg p-3 mb-4">{atividade.note}</p>
        )}

        <div className="flex gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Editar no Editor
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg px-4 hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
