import { useState } from 'react';
import type { ActivityStatus, Atividade, Objetivo, Project } from '../../types';
import { ACTIVITY_STATUS_META } from '../../types';
import { atividadesForObjetivo, blankAtividade, computeObjetivoProgress } from '../../lib/roadmap';
import { computeTotalWeeks, currentWeekOfObjetivo, formatObjetivoPeriodLabel, todayISO } from '../../utils/date';

interface Props {
  objetivos: Objetivo[];
  onObjetivosChange: (objetivos: Objetivo[]) => void;
  atividades: Atividade[];
  onChange: (atividades: Atividade[]) => void;
  projects: Project[];
  onInsertDelivery: (projectId: string, text: string) => void;
}

const STATUS_OPTIONS: ActivityStatus[] = ['planned', 'in_progress', 'done'];

const INPUT_CLASS =
  'rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20';

interface AtividadeRowProps {
  atividade: Atividade;
  projects: Project[];
  editingObjetivo: boolean;
  draftName?: string;
  draftNote?: string;
  onDraftNameChange: (id: string, value: string) => void;
  onDraftNoteChange: (id: string, value: string) => void;
  onUpdate: (id: string, patch: Partial<Atividade>) => void;
  onRemove: (id: string) => void;
  onInsertDelivery: (projectId: string, text: string) => void;
}

function AtividadeRow({
  atividade: a,
  projects,
  editingObjetivo,
  draftName,
  draftNote,
  onDraftNameChange,
  onDraftNoteChange,
  onUpdate,
  onRemove,
  onInsertDelivery,
}: AtividadeRowProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');

  function setStatus(status: ActivityStatus) {
    onUpdate(a.id, { status, completedAt: status === 'done' ? todayISO() : undefined });
  }

  function handleInsert() {
    const projectId = projects.length > 1 ? selectedProjectId : projects[0]?.id;
    if (!projectId) return;
    onInsertDelivery(projectId, a.name);
  }

  const nameEditable = a.kind === 'extra' || editingObjetivo;
  const nameValue = a.kind === 'extra' ? a.name : (draftName ?? a.name);
  const noteValue = draftNote ?? a.note ?? '';

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {nameEditable ? (
          <input
            value={nameValue}
            onChange={(e) =>
              a.kind === 'extra' ? onUpdate(a.id, { name: e.target.value }) : onDraftNameChange(a.id, e.target.value)
            }
            placeholder={a.kind === 'extra' ? 'Nome da atividade extra' : 'Nome da atividade'}
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
        <select
          value={a.status}
          onChange={(e) => setStatus(e.target.value as ActivityStatus)}
          className={`${INPUT_CLASS} shrink-0`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ACTIVITY_STATUS_META[s].label}
            </option>
          ))}
        </select>
        {a.status === 'done' && projects.length > 0 && (
          <>
            {projects.length > 1 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
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
        {a.kind === 'extra' && (
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="text-slate-400 hover:text-red-600 text-xs px-1 shrink-0"
          >
            Remover
          </button>
        )}
      </div>
      {editingObjetivo ? (
        <input
          value={noteValue}
          onChange={(e) => onDraftNoteChange(a.id, e.target.value)}
          placeholder="Anotação (opcional)"
          className={`ml-0 ${INPUT_CLASS}`}
        />
      ) : (
        a.note?.trim() && <p className="text-[10px] text-slate-400 italic leading-snug">{a.note}</p>
      )}
    </div>
  );
}

interface ObjetivoCardProps {
  objetivo: Objetivo;
  atividades: Atividade[];
  projects: Project[];
  onUpdateObjetivo: (objetivo: Objetivo) => void;
  onUpdateAtividade: (id: string, patch: Partial<Atividade>) => void;
  onAddExtra: () => void;
  onRemoveExtra: (id: string) => void;
  onInsertDelivery: (projectId: string, text: string) => void;
}

function ObjetivoCard({
  objetivo,
  atividades,
  projects,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtra,
  onRemoveExtra,
  onInsertDelivery,
}: ObjetivoCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(objetivo.name);
  const [draftEntregaLabel, setDraftEntregaLabel] = useState(objetivo.entregaLabel);
  const [draftPeriodStart, setDraftPeriodStart] = useState(objetivo.periodStart);
  const [draftPeriodEnd, setDraftPeriodEnd] = useState(objetivo.periodEnd);
  const [draftActivities, setDraftActivities] = useState<Record<string, { name?: string; note?: string }>>({});
  const [error, setError] = useState('');

  const items = atividadesForObjetivo(objetivo.id, atividades);
  const progress = computeObjetivoProgress(objetivo.id, atividades);
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

  function saveEditing() {
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

    const totalWeeks = computeTotalWeeks(draftPeriodStart, draftPeriodEnd);
    const periodLabel = formatObjetivoPeriodLabel(draftPeriodStart, draftPeriodEnd);
    onUpdateObjetivo({
      ...objetivo,
      name,
      entregaLabel,
      periodStart: draftPeriodStart,
      periodEnd: draftPeriodEnd,
      periodLabel,
      totalWeeks,
    });

    for (const a of items) {
      const draft = draftActivities[a.id];
      if (!draft) continue;
      const patch: Partial<Atividade> = {};
      if (draft.name !== undefined && draft.name.trim() !== a.name) patch.name = draft.name.trim();
      if (draft.note !== undefined && draft.note !== (a.note ?? '')) patch.note = draft.note || undefined;
      if (Object.keys(patch).length > 0) onUpdateAtividade(a.id, patch);
    }

    setDraftActivities({});
    setError('');
    setEditing(false);
  }

  function updateDraftActivity(id: string, patch: { name?: string; note?: string }) {
    setDraftActivities((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          {editing ? (
            <>
              <input
                value={draftEntregaLabel}
                onChange={(e) => setDraftEntregaLabel(e.target.value)}
                placeholder="Rótulo da entrega (ex: Entrega 1)"
                className={`w-full font-semibold uppercase tracking-wide ${INPUT_CLASS}`}
              />
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Nome do objetivo"
                className={`w-full text-sm font-bold ${INPUT_CLASS}`}
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={draftPeriodStart}
                  onChange={(e) => setDraftPeriodStart(e.target.value)}
                  className={INPUT_CLASS}
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={draftPeriodEnd}
                  onChange={(e) => setDraftPeriodEnd(e.target.value)}
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
          {!editing && (
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

      <div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-slate-900 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs font-semibold text-slate-500 mt-1">{progress}% concluído</p>
      </div>

      <div className="space-y-2">
        {items.map((a) => (
          <AtividadeRow
            key={a.id}
            atividade={a}
            projects={projects}
            editingObjetivo={editing}
            draftName={draftActivities[a.id]?.name}
            draftNote={draftActivities[a.id]?.note}
            onDraftNameChange={(id, value) => updateDraftActivity(id, { name: value })}
            onDraftNoteChange={(id, value) => updateDraftActivity(id, { note: value })}
            onUpdate={onUpdateAtividade}
            onRemove={onRemoveExtra}
            onInsertDelivery={onInsertDelivery}
          />
        ))}
      </div>

      {editing && error && <p className="text-[11px] font-medium text-red-600">{error}</p>}

      {editing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveEditing}
            className="text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAddExtra}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors w-full"
        >
          + Adicionar atividade extra
        </button>
      )}
    </div>
  );
}

export default function RoadmapEditor({
  objetivos,
  onObjetivosChange,
  atividades,
  onChange,
  projects,
  onInsertDelivery,
}: Props) {
  function update(id: string, patch: Partial<Atividade>) {
    onChange(atividades.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addExtra(objetivoId: Atividade['objetivoId']) {
    onChange([...atividades, blankAtividade(objetivoId, 'extra')]);
  }

  function removeExtra(id: string) {
    onChange(atividades.filter((a) => a.id !== id));
  }

  function updateObjetivo(updated: Objetivo) {
    onObjetivosChange(objetivos.map((o) => (o.id === updated.id ? updated : o)));
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {objetivos.map((objetivo) => (
        <ObjetivoCard
          key={objetivo.id}
          objetivo={objetivo}
          atividades={atividades}
          projects={projects}
          onUpdateObjetivo={updateObjetivo}
          onUpdateAtividade={update}
          onAddExtra={() => addExtra(objetivo.id)}
          onRemoveExtra={removeExtra}
          onInsertDelivery={onInsertDelivery}
        />
      ))}
    </div>
  );
}
