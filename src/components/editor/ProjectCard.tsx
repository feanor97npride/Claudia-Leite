import type { Project, ProjectStatus } from '../../types';
import { STATUS_META } from '../../types';

interface Props {
  project: Project;
  index: number;
  onChange: (project: Project) => void;
  onRemove: () => void;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const STATUS_OPTIONS: ProjectStatus[] = ['on_track', 'attention', 'delayed'];

export default function ProjectCard({
  project,
  index,
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 shrink-0 mt-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Mover para cima"
            aria-label="Mover projeto para cima"
            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors leading-none"
          >
            ▲
          </button>
          <span className="text-xs font-semibold text-slate-400">{index + 1}</span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Mover para baixo"
            aria-label="Mover projeto para baixo"
            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors leading-none"
          >
            ▼
          </button>
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <input
              value={project.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nome do projeto/atividade"
              aria-label="Nome do projeto/atividade"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
            {canRemove && (
              <button
                type="button"
                onClick={onRemove}
                title="Remover projeto"
                className="text-slate-400 hover:text-red-600 px-2 rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                Remover
              </button>
            )}
          </div>

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
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Riscos / bloqueios</label>
              <textarea
                value={project.risks}
                onChange={(e) => set('risks', e.target.value)}
                rows={2}
                placeholder="Se houver"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
