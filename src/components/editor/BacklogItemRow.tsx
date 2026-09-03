import type { BacklogItem, BacklogPriority, BacklogStatus, Objetivo, ObjetivoId } from '../../types';
import { BACKLOG_PRIORITY_META, BACKLOG_STATUS_META, OBJETIVO_COLOR } from '../../types';

interface Props {
  item: BacklogItem;
  objetivos: Objetivo[];
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (
    id: string,
    patch: Partial<Pick<BacklogItem, 'name' | 'objetivoId' | 'priority' | 'status'>> & { estimatedDueDate?: string | null },
  ) => void;
  onRemove: () => void;
}

const PRIORITY_OPTIONS: BacklogPriority[] = ['alta', 'media', 'baixa'];
const STATUS_OPTIONS: BacklogStatus[] = ['nao_iniciado', 'em_andamento', 'concluido'];

/**
 * Accordion item for a Backlog entry — same collapsed/expanded pattern as
 * ProjectCard (Projetos/Iniciativas da semana), deliberately less
 * structured: only Nome is required, everything else has a sensible
 * default (Prioridade Média, Status Não iniciado, sem Objetivo, sem prazo).
 */
export default function BacklogItemRow({ item, objetivos, expanded, onToggleExpand, onChange, onRemove }: Props) {
  const priorityMeta = BACKLOG_PRIORITY_META[item.priority];
  const statusMeta = BACKLOG_STATUS_META[item.status];
  const objetivo = item.objetivoId ? objetivos.find((o) => o.id === item.objetivoId) : null;

  return (
    <div
      className={`rounded-xl border transition-colors duration-150 ${
        expanded ? 'border-slate-300 bg-slate-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
        aria-expanded={expanded}
        className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 text-left px-4 py-3 cursor-pointer"
      >
        <span
          aria-hidden="true"
          className={`text-slate-400 text-[10px] shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        >
          ▸
        </span>
        {objetivo && (
          <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: OBJETIVO_COLOR[objetivo.id].bar }} />
        )}
        <span className="min-w-[100px] flex-1 text-sm font-medium text-slate-800 truncate">
          {item.name || 'Item de backlog sem nome'}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
          style={{ backgroundColor: `${priorityMeta.color}1a`, color: priorityMeta.color }}
        >
          {priorityMeta.label}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0"
          style={{ backgroundColor: `${statusMeta.color}1a`, color: statusMeta.color }}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nome da tarefa</label>
              <input
                value={item.name}
                onChange={(e) => onChange(item.id, { name: e.target.value })}
                placeholder="Nome da tarefa"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Objetivo / categoria</label>
                <select
                  value={item.objetivoId ?? ''}
                  onChange={(e) => onChange(item.id, { objetivoId: (e.target.value || null) as ObjetivoId | null })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <option value="">Sem categoria</option>
                  {objetivos.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Prazo estimado (opcional)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={item.estimatedDueDate ?? ''}
                    onChange={(e) => onChange(item.id, { estimatedDueDate: e.target.value || null })}
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                  />
                  {item.estimatedDueDate && (
                    <button
                      type="button"
                      onClick={() => onChange(item.id, { estimatedDueDate: null })}
                      title="Limpar prazo estimado"
                      className="text-slate-400 hover:text-slate-900 text-xs px-1.5 py-1.5 rounded hover:bg-slate-100 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Prioridade</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden w-fit">
                {PRIORITY_OPTIONS.map((p) => {
                  const meta = BACKLOG_PRIORITY_META[p];
                  const active = item.priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onChange(item.id, { priority: p })}
                      aria-pressed={active}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      style={active ? { backgroundColor: meta.color } : undefined}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden w-fit">
                {STATUS_OPTIONS.map((s) => {
                  const meta = BACKLOG_STATUS_META[s];
                  const active = item.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange(item.id, { status: s })}
                      aria-pressed={active}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                      style={active ? { backgroundColor: meta.color } : undefined}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={onRemove}
                className="text-slate-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors text-xs"
              >
                Remover item
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
