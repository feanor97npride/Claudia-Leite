import type { Project, ProjectStatus } from '../../types';
import { STATUS_META } from '../../types';

interface Props {
  project: Project;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (project: Project) => void;
  onRemove: () => void;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const STATUS_OPTIONS: ProjectStatus[] = ['on_track', 'attention', 'delayed'];

/**
 * Accordion item — collapsed by default (name, % concluído, status badge),
 * expands on click to the full editable form. Same pattern as the Roadmap
 * Editor's AtividadeRow: the ProjetosSection above owns which single
 * project is open at a time.
 */
export default function ProjectCard({
  project,
  index,
  expanded,
  onToggleExpand,
  onChange,
  onRemove,
  canRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Props) {
  function set<K extends keyof Project>(key: K, value: Project[K]) {
    onChange({ ...project, [key]: value });
  }

  const statusMeta = STATUS_META[project.status];

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
        <span className="min-w-[100px] flex-1 text-sm font-medium text-slate-800 truncate">
          {project.name || `Projeto ${index + 1}`}
        </span>
        <span className="text-xs text-slate-400 shrink-0">{project.percent}% concluído</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0"
          style={{ backgroundColor: `${statusMeta.color}1a`, color: statusMeta.color }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
          {statusMeta.label}
        </span>
      </div>

      {/* Same 0fr/1fr CSS-grid technique as AtividadeRow — smooth height
         animation without measuring; ProjectCard has no nested accordion
         inside it, so unlike the Roadmap list there's no duplicate-hidden-
         input risk in leaving this mounted while collapsed. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                {STATUS_OPTIONS.map((s) => {
                  const meta = STATUS_META[s];
                  const active = project.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      aria-pressed={active}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        active ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                      style={active ? { backgroundColor: meta.color } : undefined}
                    >
                      <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : meta.dot}`} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-500">
                % conclusão
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={project.percent}
                  onChange={(e) => set('percent', Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nome do projeto/atividade</label>
              <input
                value={project.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Nome do projeto/atividade"
                aria-label="Nome do projeto/atividade"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-slate-500">
                Prazo início (opcional)
                <input
                  type="date"
                  value={project.plannedStart ?? ''}
                  onChange={(e) => set('plannedStart', e.target.value || undefined)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Prazo fim (opcional)
                <input
                  type="date"
                  value={project.plannedEnd ?? ''}
                  onChange={(e) => set('plannedEnd', e.target.value || undefined)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </label>
              <p className="col-span-2 text-[11px] text-slate-400 -mt-1">
                Se preenchido, aparece como uma barra no Roadmap Timeline (aba "Roadmap Timeline"); sem prazo, aparece
                como um marcador na semana deste relatório.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/60 p-2.5">
                <label className="block text-xs font-semibold text-emerald-800 mb-1">
                  ★ Entregas da semana (destaque)
                </label>
                <textarea
                  value={project.deliveries}
                  onChange={(e) => set('deliveries', e.target.value)}
                  placeholder="O que foi entregue/concluído nesta semana"
                  rows={3}
                  className="w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>
              <div className="rounded-lg border-2 border-sky-300 bg-sky-50/60 p-2.5">
                <label className="block text-xs font-semibold text-sky-800 mb-1">
                  ★ Avanços p/ próxima semana (destaque)
                </label>
                <textarea
                  value={project.nextWeekAdvances}
                  onChange={(e) => set('nextWeekAdvances', e.target.value)}
                  placeholder="O que já foi iniciado/adiantado, mesmo fora do foco formal"
                  rows={3}
                  className="w-full rounded-md border border-sky-200 bg-white px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Próximos passos</label>
                <textarea
                  value={project.nextSteps}
                  onChange={(e) => set('nextSteps', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div
                className={`rounded-lg p-2.5 -m-2.5 sm:m-0 sm:p-0 ${
                  project.risks.trim() ? 'border border-amber-200 bg-amber-50/50 sm:border-0 sm:bg-transparent' : ''
                }`}
              >
                <label
                  className={`block text-xs font-medium mb-1 ${
                    project.risks.trim() ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  {project.risks.trim() ? '⚠ Riscos / bloqueios' : 'Riscos / bloqueios'}
                </label>
                <textarea
                  value={project.risks}
                  onChange={(e) => set('risks', e.target.value)}
                  rows={2}
                  placeholder="Se houver"
                  className={`w-full rounded-lg px-2 py-1.5 text-sm resize-none bg-white focus:outline-none focus:ring-2 ${
                    project.risks.trim()
                      ? 'border border-amber-200 focus:ring-amber-400/40'
                      : 'border border-slate-300 focus:ring-slate-900/20'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={!canMoveUp}
                  title="Mover para cima"
                  aria-label="Mover projeto para cima"
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors leading-none"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={!canMoveDown}
                  title="Mover para baixo"
                  aria-label="Mover projeto para baixo"
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors leading-none"
                >
                  ▼
                </button>
              </div>
              {canRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  title="Remover projeto"
                  className="text-slate-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors text-xs"
                >
                  Remover projeto
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
