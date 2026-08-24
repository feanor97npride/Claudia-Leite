import { useState } from 'react';
import type { ActivityStatus, Atividade, Project } from '../../types';
import { ACTIVITY_STATUS_META } from '../../types';
import { OBJETIVOS } from '../../lib/roadmapSeed';
import { atividadesForObjetivo, blankAtividade, computeObjetivoProgress } from '../../lib/roadmap';
import { currentWeekOfObjetivo, todayISO } from '../../utils/date';

interface Props {
  atividades: Atividade[];
  onChange: (atividades: Atividade[]) => void;
  projects: Project[];
  onInsertDelivery: (projectId: string, text: string) => void;
}

const STATUS_OPTIONS: ActivityStatus[] = ['planned', 'in_progress', 'done'];

interface AtividadeRowProps {
  atividade: Atividade;
  projects: Project[];
  onUpdate: (id: string, patch: Partial<Atividade>) => void;
  onRemove: (id: string) => void;
  onInsertDelivery: (projectId: string, text: string) => void;
}

function AtividadeRow({ atividade: a, projects, onUpdate, onRemove, onInsertDelivery }: AtividadeRowProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');

  function setStatus(status: ActivityStatus) {
    onUpdate(a.id, { status, completedAt: status === 'done' ? todayISO() : undefined });
  }

  function handleInsert() {
    const projectId = projects.length > 1 ? selectedProjectId : projects[0]?.id;
    if (!projectId) return;
    onInsertDelivery(projectId, a.name);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {a.kind === 'extra' ? (
        <input
          value={a.name}
          onChange={(e) => onUpdate(a.id, { name: e.target.value })}
          placeholder="Nome da atividade extra"
          className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20"
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
        className="text-xs rounded-lg border border-slate-300 px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900/20 shrink-0"
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
              className="text-[10px] rounded-lg border border-slate-300 px-1 py-1 focus:outline-none focus:ring-2 focus:ring-slate-900/20 shrink-0 max-w-[110px]"
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
  );
}

export default function RoadmapEditor({ atividades, onChange, projects, onInsertDelivery }: Props) {
  function update(id: string, patch: Partial<Atividade>) {
    onChange(atividades.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addExtra(objetivoId: Atividade['objetivoId']) {
    onChange([...atividades, blankAtividade(objetivoId, 'extra')]);
  }

  function removeExtra(id: string) {
    onChange(atividades.filter((a) => a.id !== id));
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {OBJETIVOS.map((objetivo) => {
        const items = atividadesForObjetivo(objetivo.id, atividades);
        const progress = computeObjetivoProgress(objetivo.id, atividades);
        const week = currentWeekOfObjetivo(objetivo);

        return (
          <div key={objetivo.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {objetivo.entregaLabel}
                </p>
                <p className="text-sm font-bold text-slate-900">{objetivo.name}</p>
                <p className="text-xs text-slate-400">{objetivo.periodLabel}</p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 shrink-0">
                Semana {week} de {objetivo.totalWeeks}
              </span>
            </div>

            <div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-slate-900 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1">{progress}% concluído</p>
            </div>

            <div className="space-y-1.5">
              {items.map((a) => (
                <AtividadeRow
                  key={a.id}
                  atividade={a}
                  projects={projects}
                  onUpdate={update}
                  onRemove={removeExtra}
                  onInsertDelivery={onInsertDelivery}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => addExtra(objetivo.id)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors w-full"
            >
              + Adicionar atividade extra
            </button>
          </div>
        );
      })}
    </div>
  );
}
