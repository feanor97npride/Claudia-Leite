import { useEffect, useState } from 'react';
import type { ActivityStatus, Atividade, AtividadePatch, AuditEntry, Objetivo, Subtask } from '../../types';
import { ACTIVITY_STATUS_META, TIMELINE_STATUS_META } from '../../types';
import { computeBarFillPercent, timelineVisualStatus } from '../../lib/roadmap';
import { formatShortDate, todayISO } from '../../utils/date';
import { newId } from '../../lib/storage';
import { fetchAuditLog } from '../../lib/api';
import { CHANGE_TYPE_LABEL, FIELD_LABEL, formatDateTime, formatValue } from '../history/AuditHistoryModal';

interface Props {
  atividade: Atividade;
  objetivo: Objetivo;
  readOnly: boolean;
  onClose: () => void;
  onSave: (patch: AtividadePatch) => Promise<void>;
  onEditInEditor: () => void;
}

type Tab = 'detalhes' | 'subtarefas' | 'historico';

interface Draft {
  status: ActivityStatus;
  responsavel: string;
  descricao: string;
  subtasks: Subtask[];
}

function draftFrom(a: Atividade): Draft {
  return {
    status: a.status,
    responsavel: a.raciAccountableName ?? '',
    descricao: a.note ?? '',
    subtasks: a.subtasks,
  };
}

/**
 * Roadmap Timeline's activity detail panel — replaces AtividadeDetailModal's
 * centered popup with a mockup-fidelity side panel: sticky beside the grid
 * on xl+ screens, a slide-over with a dimmed backdrop below that. 3 tabs
 * (Detalhes/Subtarefas/Histórico); Objetivo, Entrega and o Prazo continuam
 * somente leitura aqui (editá-los exige o fluxo de replanejamento com
 * motivo obrigatório do Editor — "Editar no Editor" leva até lá).
 */
export default function ActivityDetailPanel({ atividade, objetivo, readOnly, onClose, onSave, onEditInEditor }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(atividade));
  const [tab, setTab] = useState<Tab>('detalhes');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    setDraft(draftFrom(atividade));
    setTab('detalhes');
    setError('');
  }, [atividade]);

  useEffect(() => {
    if (tab !== 'historico' || entries !== null) return;
    let cancelled = false;
    fetchAuditLog('atividade', atividade.id)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, atividade.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const previewAtividade: Atividade = { ...atividade, status: draft.status, subtasks: draft.subtasks };
  const status = timelineVisualStatus(previewAtividade, todayISO());
  const statusMeta = TIMELINE_STATUS_META[status];
  const progress = computeBarFillPercent(previewAtividade, todayISO());
  const dirty =
    draft.status !== atividade.status ||
    draft.responsavel !== (atividade.raciAccountableName ?? '') ||
    draft.descricao !== (atividade.note ?? '') ||
    JSON.stringify(draft.subtasks) !== JSON.stringify(atividade.subtasks);

  function updateSubtask(id: string, percent: number) {
    setDraft((d) => ({ ...d, subtasks: d.subtasks.map((s) => (s.id === id ? { ...s, percent } : s)) }));
  }
  function renameSubtask(id: string, name: string) {
    setDraft((d) => ({ ...d, subtasks: d.subtasks.map((s) => (s.id === id ? { ...s, name } : s)) }));
  }
  function removeSubtask(id: string) {
    setDraft((d) => ({ ...d, subtasks: d.subtasks.filter((s) => s.id !== id) }));
  }
  function addSubtask() {
    setDraft((d) => ({ ...d, subtasks: [...d.subtasks, { id: newId(), name: 'Nova subtarefa', percent: 0 }] }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave({
        status: draft.status,
        raciAccountableName: draft.responsavel.trim() ? draft.responsavel.trim() : null,
        note: draft.descricao.trim() ? draft.descricao : null,
        subtasks: draft.subtasks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'detalhes', label: 'Detalhes' },
    { id: 'subtarefas', label: `Subtarefas (${draft.subtasks.length})` },
    { id: 'historico', label: 'Histórico' },
  ];

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end xl:static xl:z-auto xl:bg-transparent xl:flex xl:w-[360px] xl:h-full xl:shrink-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={atividade.name || 'Atividade'}
        className="w-[90%] max-w-[380px] h-full bg-white shadow-2xl flex flex-col xl:w-full xl:h-full xl:rounded-2xl xl:border xl:border-slate-200 xl:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-2 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: atividade.colorOverride ?? statusMeta.bg }}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 leading-snug">{atividade.name || 'Atividade sem nome'}</h2>
              <p className="text-xs text-slate-400 truncate">
                {objetivo.entregaLabel} — {objetivo.name}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-600 shrink-0 ml-2 text-lg leading-none">
            ×
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-xs font-medium px-2.5 py-2 border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {tab === 'detalhes' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Objetivo</label>
                  <input readOnly value={objetivo.name} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Entrega</label>
                  <input readOnly value={objetivo.entregaLabel} className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Data de início</label>
                  <input
                    readOnly
                    value={atividade.plannedStart ? formatShortDate(atividade.plannedStart) : 'Não definida'}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Data de término</label>
                  <input
                    readOnly
                    value={atividade.plannedEnd ? formatShortDate(atividade.plannedEnd) : 'Não definida'}
                    className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-2">
                Prazo e Objetivo são governados (exigem motivo ao replanejar) — altere pelo "Editar no Editor" abaixo.
              </p>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Status</label>
                <select
                  value={draft.status}
                  disabled={readOnly}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ActivityStatus }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {(Object.keys(ACTIVITY_STATUS_META) as ActivityStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ACTIVITY_STATUS_META[s].label}
                    </option>
                  ))}
                </select>
                {status === 'atrasado' && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">
                    Exibida como "Atrasado" na Timeline — prazo final já passou sem estar concluída.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Responsável</label>
                <input
                  value={draft.responsavel}
                  disabled={readOnly}
                  onChange={(e) => setDraft((d) => ({ ...d, responsavel: e.target.value }))}
                  placeholder="Nome do responsável"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
                {atividade.raciResponsibleName?.trim() && (
                  <p className="text-[11px] text-slate-400 mt-1">Executor (RACI): {atividade.raciResponsibleName}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-400">Progresso</label>
                  <span className="text-sm font-semibold text-slate-700">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: statusMeta.bg }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {draft.subtasks.length > 0
                    ? 'Calculado a partir da aba Subtarefas.'
                    : 'Estimado pelo tempo decorrido do prazo planejado (sem subtarefas cadastradas).'}
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={draft.descricao}
                  disabled={readOnly}
                  onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
                  placeholder="Adicione uma descrição para esta atividade"
                  className="w-full text-sm border border-slate-200 rounded-lg px-2.5 py-2 outline-none focus:border-indigo-400 resize-none placeholder:text-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </>
          )}

          {tab === 'subtarefas' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Subtarefas</p>
                {!readOnly && (
                  <button type="button" onClick={addSubtask} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer">
                    + Adicionar
                  </button>
                )}
              </div>

              {draft.subtasks.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhuma subtarefa cadastrada</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {draft.subtasks.map((s) => (
                    <div key={s.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          {readOnly ? (
                            <span className="text-sm text-slate-700 truncate">{s.name}</span>
                          ) : (
                            <input
                              value={s.name}
                              onChange={(e) => renameSubtask(s.id, e.target.value)}
                              className="flex-1 min-w-0 text-sm text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-indigo-400 outline-none bg-transparent"
                            />
                          )}
                          <span className="text-xs font-medium text-slate-500 shrink-0">{s.percent}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={s.percent}
                          disabled={readOnly}
                          onChange={(e) => updateSubtask(s.id, Number(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeSubtask(s.id)}
                          aria-label="Remover subtarefa"
                          title="Remover subtarefa"
                          className="text-slate-300 hover:text-red-600 text-sm leading-none mt-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {draft.subtasks.length > 0 && (
                <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-3 mt-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-indigo-700">Progresso calculado das subtarefas</p>
                    <span className="text-xs font-bold text-indigo-700">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'historico' && (
            <div className="flex flex-col gap-2">
              {historyError ? (
                <p role="alert" className="text-sm text-red-600">
                  {historyError}
                </p>
              ) : entries === null ? (
                <p className="text-sm text-slate-400 italic">Carregando…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  Nenhuma alteração registrada ainda.
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
          )}
        </div>

        {error && <p className="px-4 text-xs text-red-600 -mt-2 mb-2">{error}</p>}

        <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving}
              className="flex-1 text-sm font-medium bg-slate-900 text-white rounded-lg py-2.5 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          )}
          <button
            type="button"
            onClick={onEditInEditor}
            className="text-sm font-medium border border-slate-200 rounded-lg px-4 py-2.5 text-slate-600 hover:border-slate-300 cursor-pointer"
          >
            Editar no Editor
          </button>
        </div>
      </div>
    </div>
  );
}
