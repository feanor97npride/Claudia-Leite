import { useEffect, useState } from 'react';
import type { AuditEntityType, AuditEntry, ChangeType } from '../../types';
import { fetchAuditLog } from '../../lib/api';

interface Props {
  entityType: AuditEntityType;
  entityId: string;
  title: string;
  onClose: () => void;
}

const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  escopo: 'Escopo',
  prazo: 'Prazo',
  status: 'Status',
  outro: 'Outro',
};

const FIELD_LABEL: Record<string, string> = {
  name: 'Nome',
  entregaLabel: 'Rótulo da entrega',
  note: 'Anotação',
  raciAccountableName: 'Responsável (RACI)',
  raciResponsibleName: 'Executor (RACI)',
  periodStart: 'Início do período',
  periodEnd: 'Fim do período',
  plannedStart: 'Início planejado',
  plannedEnd: 'Fim planejado',
  completedAt: 'Data de conclusão',
  status: 'Status',
};

function formatValue(v: string | null): string {
  return v === null || v === '' ? '—' : v;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/** Bloco 1.1: read-only change/audit log viewer for one Objetivo or Atividade —
 *  visible to both Admin and Visualizador, since it's a governance artifact, not
 *  an editing surface. */
export default function AuditHistoryModal({ entityType, entityId, title, onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [replanCount, setReplanCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAuditLog(entityType, entityId)
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
        setReplanCount(res.replanCount);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

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
        aria-label="Histórico de Alterações"
        className="w-full max-w-lg max-h-[80vh] bg-white rounded-2xl shadow-lg border border-slate-200 p-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold text-slate-900">Histórico de Alterações</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-900 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-3">{title}</p>
        {replanCount > 0 && (
          <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-3 w-fit">
            {replanCount} replanejamento{replanCount > 1 ? 's' : ''} registrado{replanCount > 1 ? 's' : ''}
          </p>
        )}
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : entries === null ? (
            <p className="text-sm text-slate-400 italic">Carregando…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded-xl">
              Nenhuma alteração registrada ainda.
              <br />
              Edições feitas aqui (nome, datas, status, RACI) vão aparecer nesta lista.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-slate-700">{FIELD_LABEL[entry.field] ?? entry.field}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">
                      {CHANGE_TYPE_LABEL[entry.changeType] ?? entry.changeType}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <span className="line-through text-slate-400">{formatValue(entry.oldValue)}</span>
                    {' → '}
                    <span className="font-medium">{formatValue(entry.newValue)}</span>
                  </p>
                  {entry.reason && <p className="text-slate-500 italic mt-1">Motivo: {entry.reason}</p>}
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {entry.actorLabel} · {formatDateTime(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
