import { useState } from 'react';
import type { ActivityStatus, Atividade, AtividadePatch, Objetivo, ObjetivoId, Project } from '../../types';
import { ACTIVITY_STATUS_META, TONE_META } from '../../types';
import {
  atividadesForObjetivo,
  computeAheadBehindPercent,
  computeObjetivoAheadBehind,
  computeObjetivoProgress,
} from '../../lib/roadmap';
import { computeTotalWeeks, currentWeekOfObjetivo, formatObjetivoPeriodLabel, todayISO } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import AuditHistoryModal from '../history/AuditHistoryModal';
import ConfirmDialog from '../ConfirmDialog';

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  projects: Project[];
  readOnly: boolean;
  onInsertDelivery: (projectId: string, text: string) => void;
  onUpdateObjetivo: (id: ObjetivoId, patch: Partial<Objetivo>) => Promise<void>;
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  onAddExtra: (objetivoId: ObjetivoId, name: string) => Promise<void>;
  onRemoveExtra: (id: string) => Promise<void>;
}

const STATUS_OPTIONS: ActivityStatus[] = ['planned', 'in_progress', 'done'];

const INPUT_CLASS =
  'rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20';

export interface ActivityDraft {
  name?: string;
  note?: string;
  plannedStart?: string;
  plannedEnd?: string;
  completedAt?: string;
  raciAccountableName?: string;
  raciResponsibleName?: string;
  reason?: string;
}

function AheadBehindBadge({ atividade }: { atividade: Atividade }) {
  const pct = computeAheadBehindPercent(atividade);
  if (pct === null) {
    return <span className="text-[10px] text-slate-400 italic shrink-0">sem dados de prazo</span>;
  }
  const tone = TONE_META[pct > 0 ? 'good' : pct < 0 ? 'bad' : 'neutral'];
  const label = pct > 0 ? `+${pct}% adiantada` : pct < 0 ? `${pct}% atrasada` : 'No prazo (0%)';
  return (
    <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${tone.text} ${tone.bg}`}>{label}</span>
  );
}

interface AtividadeRowProps {
  atividade: Atividade;
  projects: Project[];
  readOnly: boolean;
  editingObjetivo: boolean;
  draft?: ActivityDraft;
  onDraftChange: (id: string, patch: Partial<ActivityDraft>) => void;
  onUpdate: (id: string, patch: AtividadePatch) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onInsertDelivery: (projectId: string, text: string) => void;
}

function AtividadeRow({
  atividade: a,
  projects,
  readOnly,
  editingObjetivo,
  draft,
  onDraftChange,
  onUpdate,
  onRemove,
  onInsertDelivery,
}: AtividadeRowProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { showToast } = useToast();

  async function handleConfirmRemove() {
    setRemoving(true);
    try {
      await onRemove(a.id);
      setConfirmingRemove(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível remover a atividade.', 'error');
    } finally {
      setRemoving(false);
    }
  }

  async function setStatus(status: ActivityStatus) {
    try {
      await onUpdate(a.id, { status, completedAt: status === 'done' ? todayISO() : undefined });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível atualizar o status.', 'error');
    }
  }

  function handleInsert() {
    const projectId = projects.length > 1 ? selectedProjectId : projects[0]?.id;
    if (!projectId) return;
    onInsertDelivery(projectId, a.name);
  }

  async function handleExtraNameBlur(value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === a.name) return;
    try {
      await onUpdate(a.id, { name: trimmed });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível renomear a atividade.', 'error');
    }
  }

  const nameEditable = (a.kind === 'extra' && !readOnly) || editingObjetivo;
  const nameValue = draft?.name ?? a.name;
  const noteValue = draft?.note ?? a.note ?? '';
  const plannedStartValue = draft?.plannedStart ?? a.plannedStart ?? '';
  const plannedEndValue = draft?.plannedEnd ?? a.plannedEnd ?? '';
  const completedAtValue = draft?.completedAt ?? a.completedAt ?? '';
  const completedAtIsFuture = completedAtValue > todayISO();
  const raciAccountableValue = draft?.raciAccountableName ?? a.raciAccountableName ?? '';
  const raciResponsibleValue = draft?.raciResponsibleName ?? a.raciResponsibleName ?? '';

  const replanningStart = editingObjetivo && !!a.plannedStart && plannedStartValue !== a.plannedStart;
  const replanningEnd = editingObjetivo && !!a.plannedEnd && plannedEndValue !== a.plannedEnd;
  const needsReason = replanningStart || replanningEnd;

  return (
    <div className="flex flex-col gap-1" data-testid={`atividade-row-${a.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        {nameEditable ? (
          <input
            value={nameValue}
            onChange={(e) => onDraftChange(a.id, { name: e.target.value })}
            onBlur={(e) => {
              if (a.kind === 'extra' && !editingObjetivo) void handleExtraNameBlur(e.target.value);
            }}
            placeholder={a.kind === 'extra' ? 'Nome da atividade extra' : 'Nome da atividade'}
            aria-label={a.kind === 'extra' ? 'Nome da atividade extra' : 'Nome da atividade'}
            className={`flex-1 min-w-[120px] ${INPUT_CLASS}`}
          />
        ) : (
          <p className="flex-1 text-xs text-slate-700 leading-snug min-w-[120px]">{a.name}</p>
        )}
        {a.kind === 'extra' && (
          <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 shrink-0">
            Extra
          </span>
        )}
        {readOnly ? (
          <span className="text-xs text-slate-600 shrink-0">{ACTIVITY_STATUS_META[a.status].label}</span>
        ) : (
          <select
            value={a.status}
            onChange={(e) => void setStatus(e.target.value as ActivityStatus)}
            aria-label={`Status da atividade: ${a.name || 'sem nome'}`}
            className={`${INPUT_CLASS} shrink-0`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_STATUS_META[s].label}
              </option>
            ))}
          </select>
        )}
        {a.status === 'done' && !editingObjetivo && <AheadBehindBadge atividade={a} />}
        {a.status === 'done' && projects.length > 0 && (
          <>
            {projects.length > 1 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Projeto para inserir a entrega"
                className={`text-[10px] px-1 shrink-0 max-w-[110px] ${INPUT_CLASS}`}
              >
                {projects.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `Projeto ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleInsert}
              title="Inserir em Entregas da semana"
              className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded px-1.5 py-1 shrink-0 transition-colors"
            >
              + Entrega
            </button>
          </>
        )}
        {a.kind === 'extra' && !readOnly && !editingObjetivo && (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="text-slate-400 hover:text-red-600 text-xs px-1 shrink-0"
          >
            Remover
          </button>
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          title="Histórico de alterações"
          aria-label="Ver histórico de alterações"
          className="text-slate-400 hover:text-slate-900 text-xs shrink-0 px-1"
        >
          🕘
        </button>
      </div>
      {editingObjetivo && (
        <div className="flex flex-col gap-1 rounded-lg bg-slate-50 p-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 shrink-0">Prazo:</span>
            <input
              type="date"
              value={plannedStartValue}
              onChange={(e) => onDraftChange(a.id, { plannedStart: e.target.value })}
              aria-label={`Início planejado — ${a.name || 'atividade'}`}
              className={`${INPUT_CLASS} shrink-0`}
            />
            <span className="text-[10px] text-slate-400 shrink-0">até</span>
            <input
              type="date"
              value={plannedEndValue}
              onChange={(e) => onDraftChange(a.id, { plannedEnd: e.target.value })}
              aria-label={`Fim planejado — ${a.name || 'atividade'}`}
              className={`${INPUT_CLASS} shrink-0`}
            />
            {a.status === 'done' && (
              <>
                <span className="text-[10px] text-slate-400 shrink-0 ml-1.5">Concluída em:</span>
                <input
                  type="date"
                  value={completedAtValue}
                  onChange={(e) => onDraftChange(a.id, { completedAt: e.target.value })}
                  aria-label={`Data de conclusão — ${a.name || 'atividade'}`}
                  className={`${INPUT_CLASS} shrink-0`}
                />
                {completedAtIsFuture && (
                  <span title="Data de conclusão no futuro" className="text-amber-500 text-xs shrink-0">
                    ⚠
                  </span>
                )}
              </>
            )}
          </div>
          {needsReason && (
            <input
              value={draft?.reason ?? ''}
              onChange={(e) => onDraftChange(a.id, { reason: e.target.value })}
              placeholder="Motivo da mudança (obrigatório ao replanejar) — ex: Dependência externa"
              aria-label="Motivo da mudança"
              className={`w-full ${INPUT_CLASS} ${!draft?.reason?.trim() ? 'border-amber-400' : ''}`}
            />
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 shrink-0">Responsável (Accountable):</span>
            <input
              value={raciAccountableValue}
              onChange={(e) => onDraftChange(a.id, { raciAccountableName: e.target.value })}
              placeholder="Nome"
              aria-label="Responsável (Accountable)"
              className={`flex-1 min-w-[100px] ${INPUT_CLASS}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 shrink-0">Executor (Responsible):</span>
            <input
              value={raciResponsibleValue}
              onChange={(e) => onDraftChange(a.id, { raciResponsibleName: e.target.value })}
              placeholder="Nome"
              aria-label="Executor (Responsible)"
              className={`flex-1 min-w-[100px] ${INPUT_CLASS}`}
            />
          </div>
          <input
            value={noteValue}
            onChange={(e) => onDraftChange(a.id, { note: e.target.value })}
            placeholder="Anotação (opcional)"
            aria-label="Anotação"
            className={INPUT_CLASS}
          />
        </div>
      )}
      {!editingObjetivo && a.note?.trim() && (
        <p className="text-[10px] text-slate-400 italic leading-snug">{a.note}</p>
      )}
      {!editingObjetivo && (a.raciAccountableName?.trim() || a.raciResponsibleName?.trim()) && (
        <p className="text-[10px] text-slate-400 leading-snug">
          {a.raciAccountableName?.trim() && <>Responsável: {a.raciAccountableName}</>}
          {a.raciAccountableName?.trim() && a.raciResponsibleName?.trim() && ' · '}
          {a.raciResponsibleName?.trim() && <>Executor: {a.raciResponsibleName}</>}
        </p>
      )}
      {historyOpen && (
        <AuditHistoryModal
          entityType="atividade"
          entityId={a.id}
          title={a.name || 'Atividade'}
          onClose={() => setHistoryOpen(false)}
        />
      )}
      {confirmingRemove && (
        <ConfirmDialog
          title="Remover atividade extra?"
          message={`"${a.name || 'Atividade'}" será removida permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel={removing ? 'Removendo…' : 'Remover'}
          onConfirm={() => void handleConfirmRemove()}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  );
}

interface ObjetivoCardProps {
  objetivo: Objetivo;
  atividades: Atividade[];
  projects: Project[];
  readOnly: boolean;
  onUpdateObjetivo: (id: ObjetivoId, patch: Partial<Objetivo>) => Promise<void>;
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  onAddExtra: (objetivoId: ObjetivoId, name: string) => Promise<void>;
  onRemoveExtra: (id: string) => Promise<void>;
  onInsertDelivery: (projectId: string, text: string) => void;
}

function ObjetivoCard({
  objetivo,
  atividades,
  projects,
  readOnly,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtra,
  onRemoveExtra,
  onInsertDelivery,
}: ObjetivoCardProps) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState(objetivo.name);
  const [draftEntregaLabel, setDraftEntregaLabel] = useState(objetivo.entregaLabel);
  const [draftPeriodStart, setDraftPeriodStart] = useState(objetivo.periodStart);
  const [draftPeriodEnd, setDraftPeriodEnd] = useState(objetivo.periodEnd);
  const [draftActivities, setDraftActivities] = useState<Record<string, ActivityDraft>>({});
  const [error, setError] = useState('');
  const [addingExtra, setAddingExtra] = useState(false);
  const [newExtraName, setNewExtraName] = useState('');

  const items = atividadesForObjetivo(objetivo.id, atividades);
  const progress = computeObjetivoProgress(objetivo.id, atividades);
  const aheadBehind = computeObjetivoAheadBehind(objetivo.id, atividades);
  const week = currentWeekOfObjetivo(objetivo);

  function startEditing() {
    setDraftName(objetivo.name);
    setDraftEntregaLabel(objetivo.entregaLabel);
    setDraftPeriodStart(objetivo.periodStart);
    setDraftPeriodEnd(objetivo.periodEnd);
    setDraftActivities({});
    setError('');
    setEditing(true);
  }

  function cancelEditing() {
    setDraftActivities({});
    setError('');
    setEditing(false);
  }

  async function saveEditing() {
    const name = draftName.trim();
    const entregaLabel = draftEntregaLabel.trim();
    if (!name) {
      setError('O nome do objetivo não pode ficar vazio.');
      return;
    }
    if (!entregaLabel) {
      setError('O rótulo da entrega não pode ficar vazio.');
      return;
    }
    if (!(draftPeriodStart < draftPeriodEnd)) {
      setError('A data de início deve ser anterior à data de fim.');
      return;
    }
    const plannedItems = items.filter((a) => a.kind === 'planned');
    for (const a of plannedItems) {
      const draftedName = draftActivities[a.id]?.name;
      const effective = (draftedName ?? a.name).trim();
      if (!effective) {
        setError('Nenhuma atividade pode ficar com o nome vazio.');
        return;
      }
    }
    for (const a of items) {
      const draft = draftActivities[a.id];
      if (!draft) continue;
      const plannedStart = draft.plannedStart ?? a.plannedStart;
      const plannedEnd = draft.plannedEnd ?? a.plannedEnd;
      if (plannedStart && plannedEnd && !(plannedStart < plannedEnd)) {
        setError(`"${a.name || 'Atividade'}": a data de início planejada deve ser anterior à data de fim planejada.`);
        return;
      }
      const replanning =
        (!!a.plannedStart && draft.plannedStart !== undefined && draft.plannedStart !== a.plannedStart) ||
        (!!a.plannedEnd && draft.plannedEnd !== undefined && draft.plannedEnd !== a.plannedEnd);
      if (replanning && !draft.reason?.trim()) {
        setError(`"${a.name || 'Atividade'}": informe o motivo da mudança para replanejar a data.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const datesChanged = draftPeriodStart !== objetivo.periodStart || draftPeriodEnd !== objetivo.periodEnd;
      const objetivoPatch: Partial<Objetivo> = { name, entregaLabel };
      if (datesChanged) {
        objetivoPatch.periodStart = draftPeriodStart;
        objetivoPatch.periodEnd = draftPeriodEnd;
        objetivoPatch.totalWeeks = computeTotalWeeks(draftPeriodStart, draftPeriodEnd);
        objetivoPatch.periodLabel = formatObjetivoPeriodLabel(draftPeriodStart, draftPeriodEnd);
      }
      await onUpdateObjetivo(objetivo.id, objetivoPatch);

      for (const a of items) {
        const draft = draftActivities[a.id];
        if (!draft) continue;
        const patch: AtividadePatch = {};
        if (draft.name !== undefined && draft.name.trim() !== a.name) patch.name = draft.name.trim();
        if (draft.note !== undefined && draft.note !== (a.note ?? '')) patch.note = draft.note || null;
        if (draft.plannedStart !== undefined && draft.plannedStart !== (a.plannedStart ?? ''))
          patch.plannedStart = draft.plannedStart || null;
        if (draft.plannedEnd !== undefined && draft.plannedEnd !== (a.plannedEnd ?? ''))
          patch.plannedEnd = draft.plannedEnd || null;
        if (draft.completedAt !== undefined && draft.completedAt !== (a.completedAt ?? ''))
          patch.completedAt = draft.completedAt || null;
        if (draft.raciAccountableName !== undefined && draft.raciAccountableName !== (a.raciAccountableName ?? ''))
          patch.raciAccountableName = draft.raciAccountableName || null;
        if (draft.raciResponsibleName !== undefined && draft.raciResponsibleName !== (a.raciResponsibleName ?? ''))
          patch.raciResponsibleName = draft.raciResponsibleName || null;
        if (draft.reason?.trim()) patch.reason = draft.reason.trim();
        if (Object.keys(patch).length > 0) await onUpdateAtividade(a.id, patch);
      }

      setDraftActivities({});
      setEditing(false);
      showToast('Alterações salvas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  function updateDraftActivity(id: string, patch: Partial<ActivityDraft>) {
    setDraftActivities((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleAddExtra() {
    const name = newExtraName.trim();
    if (!name) return;
    try {
      await onAddExtra(objetivo.id, name);
      setNewExtraName('');
      setAddingExtra(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível adicionar a atividade.', 'error');
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" data-testid={`objetivo-card-${objetivo.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {editing ? (
            <>
              <input
                value={draftEntregaLabel}
                onChange={(e) => setDraftEntregaLabel(e.target.value)}
                placeholder="Rótulo da entrega (ex: Entrega 1)"
                aria-label="Rótulo da entrega"
                className={`w-full font-semibold uppercase tracking-wide ${INPUT_CLASS}`}
              />
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nome do objetivo"
                aria-label="Nome do objetivo"
                className={`w-full text-sm font-bold ${INPUT_CLASS}`}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={draftPeriodStart}
                  onChange={(e) => setDraftPeriodStart(e.target.value)}
                  aria-label="Início do período do objetivo"
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={draftPeriodEnd}
                  onChange={(e) => setDraftPeriodEnd(e.target.value)}
                  aria-label="Fim do período do objetivo"
                  className={INPUT_CLASS}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {objetivo.entregaLabel}
              </p>
              <p className="text-sm font-bold text-slate-900">{objetivo.name}</p>
              <p className="text-xs text-slate-400">{objetivo.periodLabel}</p>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
            Semana {week} de {objetivo.totalWeeks}
          </span>
          <div className="flex gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors"
              >
                🕘 Histórico
              </button>
            )}
            {!editing && !readOnly && (
              <button
                type="button"
                onClick={startEditing}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors"
              >
                ✎ Editar
              </button>
            )}
          </div>
        </div>
      </div>
      {historyOpen && (
        <AuditHistoryModal
          entityType="objetivo"
          entityId={objetivo.id}
          title={`${objetivo.entregaLabel} — ${objetivo.name}`}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">{progress}% concluído</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Adiantamento médio</p>
          <p
            className={`text-xs font-semibold ${
              aheadBehind === null
                ? 'text-slate-400 italic'
                : TONE_META[aheadBehind > 0 ? 'good' : aheadBehind < 0 ? 'bad' : 'neutral'].text
            }`}
          >
            {aheadBehind === null ? 'sem dados' : `${aheadBehind > 0 ? '+' : ''}${aheadBehind}%`}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Nenhuma atividade cadastrada ainda.
          {!readOnly && ' Adicione uma atividade extra abaixo para começar.'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <AtividadeRow
              key={a.id}
              atividade={a}
              projects={projects}
              readOnly={readOnly}
              editingObjetivo={editing}
              draft={draftActivities[a.id]}
              onDraftChange={updateDraftActivity}
              onUpdate={onUpdateAtividade}
              onRemove={onRemoveExtra}
              onInsertDelivery={onInsertDelivery}
            />
          ))}
        </div>
      )}

      {editing && error && <p className="text-[11px] font-medium text-red-600">{error}</p>}

      {editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void saveEditing()}
            disabled={saving}
            className="text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            disabled={saving}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      ) : (
        !readOnly &&
        (addingExtra ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newExtraName}
              onChange={(e) => setNewExtraName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddExtra();
                if (e.key === 'Escape') {
                  setAddingExtra(false);
                  setNewExtraName('');
                }
              }}
              placeholder="Nome da atividade extra"
              aria-label="Nome da nova atividade extra"
              className={`flex-1 ${INPUT_CLASS}`}
            />
            <button
              type="button"
              onClick={() => void handleAddExtra()}
              className="text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors"
            >
              Adicionar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingExtra(true)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors w-full"
          >
            + Adicionar atividade extra
          </button>
        ))
      )}
    </div>
  );
}

export default function RoadmapEditor({
  objetivos,
  atividades,
  projects,
  readOnly,
  onInsertDelivery,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtra,
  onRemoveExtra,
}: Props) {
  if (objetivos.length === 0) {
    return <p className="text-sm text-slate-400 italic">Carregando roadmap…</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {objetivos.map((objetivo) => (
        <ObjetivoCard
          key={objetivo.id}
          objetivo={objetivo}
          atividades={atividades}
          projects={projects}
          readOnly={readOnly}
          onUpdateObjetivo={onUpdateObjetivo}
          onUpdateAtividade={onUpdateAtividade}
          onAddExtra={onAddExtra}
          onRemoveExtra={onRemoveExtra}
          onInsertDelivery={onInsertDelivery}
        />
      ))}
    </div>
  );
}
