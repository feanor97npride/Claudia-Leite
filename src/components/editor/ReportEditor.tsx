import { useState } from 'react';
import type { Atividade, AtividadePatch, Objetivo, ObjetivoId, Report } from '../../types';
import { blankProject } from '../../lib/factory';
import { formatPeriodLabel } from '../../utils/date';
import ProjectCard from './ProjectCard';
import IndicatorsEditor from './IndicatorsEditor';
import RoadmapEditor, { type FocusAtividade } from './RoadmapEditor';
import GovernanceIndicators from './GovernanceIndicators';

interface Props {
  report: Report;
  onChange: (report: Report) => void;
  atividades: Atividade[];
  objetivos: Objetivo[];
  roadmapReadOnly: boolean;
  onUpdateObjetivo: (id: ObjetivoId, patch: Partial<Objetivo>) => Promise<void>;
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  onAddExtraAtividade: (objetivoId: ObjetivoId, name: string) => Promise<Atividade>;
  onRemoveExtraAtividade: (id: string) => Promise<void>;
  focusAtividade?: FocusAtividade | null;
  onFocusHandled?: () => void;
}

export default function ReportEditor({
  report,
  onChange,
  atividades,
  objetivos,
  roadmapReadOnly,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtraAtividade,
  onRemoveExtraAtividade,
  focusAtividade,
  onFocusHandled,
}: Props) {
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  function set<K extends keyof Report>(key: K, value: Report[K]) {
    onChange({ ...report, [key]: value });
  }

  function setWeekStart(weekStart: string) {
    onChange({ ...report, weekStart, periodLabel: formatPeriodLabel(weekStart) });
  }

  function updateProject(index: number, project: Report['projects'][number]) {
    const projects = [...report.projects];
    projects[index] = project;
    set('projects', projects);
  }

  function addProject() {
    set('projects', [...report.projects, blankProject()]);
  }

  function removeProject(index: number) {
    set('projects', report.projects.filter((_, i) => i !== index));
  }

  function moveProject(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= report.projects.length) return;
    const projects = [...report.projects];
    [projects[index], projects[target]] = [projects[target], projects[index]];
    set('projects', projects);
  }

  function insertDeliveryFromActivity(projectId: string, activityName: string) {
    const index = report.projects.findIndex((p) => p.id === projectId);
    if (index === -1) return;
    const project = report.projects[index];
    const alreadyPresent = project.deliveries
      .split('\n')
      .some((line) => line.trim() === activityName.trim());
    if (alreadyPresent) return;
    const deliveries = project.deliveries ? `${project.deliveries}\n${activityName}` : activityName;
    updateProject(index, { ...project, deliveries });
  }

  return (
    <div className="space-y-5 pb-24">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Cabeçalho</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Área</label>
            <input
              value={report.area}
              onChange={(e) => set('area', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Semana (segunda-feira)</label>
            <input
              type="date"
              value={report.weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Responsável</label>
            <input
              value={report.responsible}
              onChange={(e) => set('responsible', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Período (exibido no report)</label>
          <input
            value={report.periodLabel}
            onChange={(e) => set('periodLabel', e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Resumo executivo</h2>
        <textarea
          value={report.execSummary}
          onChange={(e) => set('execSummary', e.target.value)}
          placeholder="2-3 linhas sobre o andamento geral da semana"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setProjectsSectionOpen((v) => !v)}
          aria-expanded={projectsSectionOpen}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              aria-hidden="true"
              className={`text-slate-400 text-[10px] shrink-0 transition-transform duration-200 ${projectsSectionOpen ? 'rotate-90' : ''}`}
            >
              ▸
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projetos / Iniciativas da semana
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              (narrativa livre — não faz parte do roadmap governado)
            </span>
            <span className="text-xs font-medium bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
              {report.projects.length}
            </span>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              addProject();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                addProject();
              }
            }}
            className="text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            + Adicionar projeto
          </span>
        </button>

        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${projectsSectionOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">
              {report.projects.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  expanded={project.id === expandedProjectId}
                  onToggleExpand={() =>
                    setExpandedProjectId((cur) => (cur === project.id ? null : project.id))
                  }
                  onChange={(p) => updateProject(i, p)}
                  onRemove={() => removeProject(i)}
                  canRemove={report.projects.length > 1}
                  onMoveUp={() => moveProject(i, -1)}
                  onMoveDown={() => moveProject(i, 1)}
                  canMoveUp={i > 0}
                  canMoveDown={i < report.projects.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Roadmap — Estruturação da Área de Sistemas
        </h2>
        <RoadmapEditor
          objetivos={objetivos}
          atividades={atividades}
          currentWeekStart={report.weekStart}
          projects={report.projects}
          readOnly={roadmapReadOnly}
          onInsertDelivery={insertDeliveryFromActivity}
          onUpdateObjetivo={onUpdateObjetivo}
          onUpdateAtividade={onUpdateAtividade}
          onAddExtra={onAddExtraAtividade}
          onRemoveExtra={onRemoveExtraAtividade}
          focusAtividade={focusAtividade}
          onFocusHandled={onFocusHandled}
        />
      </section>

      <GovernanceIndicators atividades={atividades} />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
          Indicadores gerais <span className="normal-case text-slate-400">(opcional)</span>
        </h2>
        <IndicatorsEditor indicators={report.indicators} onChange={(v) => set('indicators', v)} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Destaques da semana</h2>
          <textarea
            value={report.highlights}
            onChange={(e) => set('highlights', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Pontos de atenção</h2>
          <textarea
            value={report.attentionPoints}
            onChange={(e) => set('attentionPoints', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Próximos Passos</h2>
        <textarea
          value={report.nextSteps}
          onChange={(e) => set('nextSteps', e.target.value)}
          placeholder="Anotação livre da equipe, independente de projetos/objetivos"
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
      </section>
    </div>
  );
}
