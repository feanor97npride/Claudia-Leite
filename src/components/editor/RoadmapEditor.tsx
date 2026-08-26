import { useEffect, useRef, useState } from 'react';
import type { ActivityStatus, Atividade, AtividadePatch, Objetivo, ObjetivoId, Project, TimelineVisualStatus } from '../../types';
import { STATUS_META, TIMELINE_STATUS_META, TONE_META } from '../../types';
import {
  atividadesForObjetivo,
  computeAheadBehindPercent,
  computeObjetivoAheadBehind,
  computeObjetivoProgress,
  isVisibleThisWeek,
  timelineVisualStatus,
} from '../../lib/roadmap';
import { computeTotalWeeks, currentWeekOfObjetivo, formatObjetivoPeriodLabel, todayISO } from '../../utils/date';
import { useToast } from '../../contexts/ToastContext';
import AuditHistoryModal from '../history/AuditHistoryModal';
import ConfirmDialog from '../ConfirmDialog';

export interface FocusAtividade {
  objetivoId: ObjetivoId;
  atividadeId: string;
}

interface Props {
  objetivos: Objetivo[];
  atividades: Atividade[];
  currentWeekStart: string;
  projects: Project[];
  readOnly: boolean;
  onInsertDelivery: (projectId: string, text: string) => void;
  onUpdateObjetivo: (id: ObjetivoId, patch: Partial<Objetivo>) => Promise<void>;
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  onAddExtra: (objetivoId: ObjetivoId, name: string) => Promise<Atividade>;
  onRemoveExtra: (id: string) => Promise<void>;
  /** Set once (e.g. from clicking an activity in the Roadmap Timeline) to
   *  jump straight to that Objetivo's card in edit mode, scrolled into
   *  view, with the row briefly highlighted. Consumed once via
   *  onFocusHandled so it doesn't re-trigger on every re-render. */
  focusAtividade?: FocusAtividade | null;
  onFocusHandled?: () => void;
}

const STATUS_OPTIONS: ActivityStatus[] = ['planned', 'in_progress', 'done'];

const INPUT_CLASS =
  'rounded-lg border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/20';

export interface ActivityDraft {
  name?: string;
  note?: string;
  status?: ActivityStatus;
  plannedStart?: string;
  plannedEnd?: string;
  completedAt?: string;
  raciAccountableName?: string;
  raciResponsibleName?: string;
  objetivoId?: ObjetivoId;
  reason?: string;
}

/** "2026-08-15" -> "15/08" — compact, no year, for the collapsed card
 *  summary and the read-mode field list (the full "dd/mm/aaaa" format
 *  used elsewhere would be too wide for a one-line summary). */
function shortDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Local labels for the accordion's status badge — kept as the words this
 *  screen already used (Planejada/Em andamento/Concluída, from
 *  ACTIVITY_STATUS_META) plus "Atrasada" for the derived 4th state, rather
 *  than reusing the Roadmap Timeline's "Não iniciado"/"Atrasado" wording
 *  (same underlying timelineVisualStatus, same TIMELINE_STATUS_META
 *  colors — just this screen's own established terminology for the label). */
const ITEM_STATUS_LABEL: Record<TimelineVisualStatus, string> = {
  done: 'Concluída',
  in_progress: 'Em andamento',
  planned: 'Planejada',
  atrasado: 'Atrasada',
};

function StatusBadge({ atividade }: { atividade: Atividade }) {
  const status = timelineVisualStatus(atividade, todayISO());
  const meta = TIMELINE_STATUS_META[status];
  return (
    <span
      className={`text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${
        status === 'planned' ? 'border' : ''
      }`}
      style={{ backgroundColor: meta.bg, color: meta.text, borderColor: meta.border }}
    >
      {ITEM_STATUS_LABEL[status]}
    </span>
  );
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
  objetivos: Objetivo[];
  projects: Project[];
  readOnly: boolean;
  expanded: boolean;
  editMode: boolean;
  highlighted?: boolean;
  draft?: ActivityDraft;
  onToggleExpand: () => void;
  onDraftChange: (id: string, patch: Partial<ActivityDraft>) => void;
  onRemove: (id: string) => Promise<void>;
  onInsertDelivery: (projectId: string, text: string) => void;
}

/**
 * One accordion row: a compact always-visible summary (name, short "dd/mm
 * até dd/mm" prazo, responsável, status badge) that expands to the full
 * field set on click. Whether the expanded fields render as read-only text
 * or as editable inputs is controlled separately by `editMode` (the list's
 * own "Editar"/"Concluir edição" toggle in ObjetivoCard) — collapsing and
 * editing are two independent axes, not the same state.
 */
function AtividadeRow({
  atividade: a,
  objetivos,
  projects,
  readOnly,
  expanded,
  editMode,
  highlighted,
  draft,
  onToggleExpand,
  onDraftChange,
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

  function handleInsert() {
    const projectId = projects.length > 1 ? selectedProjectId : projects[0]?.id;
    if (!projectId) return;
    onInsertDelivery(projectId, a.name);
  }

  const nameValue = draft?.name ?? a.name;
  const statusValue = draft?.status ?? a.status;
  const noteValue = draft?.note ?? a.note ?? '';
  const plannedStartValue = draft?.plannedStart ?? a.plannedStart ?? '';
  const plannedEndValue = draft?.plannedEnd ?? a.plannedEnd ?? '';
  const completedAtValue = draft?.completedAt ?? a.completedAt ?? '';
  const completedAtIsFuture = completedAtValue > todayISO();
  const raciAccountableValue = draft?.raciAccountableName ?? a.raciAccountableName ?? '';
  const raciResponsibleValue = draft?.raciResponsibleName ?? a.raciResponsibleName ?? '';
  const objetivoIdValue = draft?.objetivoId ?? a.objetivoId;

  const replanningStart = editMode && !!a.plannedStart && plannedStartValue !== a.plannedStart;
  const replanningEnd = editMode && !!a.plannedEnd && plannedEndValue !== a.plannedEnd;
  const needsReason = replanningStart || replanningEnd;
  const isDone = a.status === 'done';
  // Same 4-state derivation/colors as the Roadmap Timeline (Fase 1), just
  // this screen's own label wording (ITEM_STATUS_LABEL).
  const visualStatus = timelineVisualStatus(a, todayISO());
  const isPending = !a.plannedStart || !a.plannedEnd || !a.raciAccountableName?.trim();

  return (
    <div
      className={`rounded-lg transition-colors duration-150 ease-out ${
        highlighted ? 'ring-2 ring-amber-400 bg-amber-50/60' : ''
      }`}
      data-testid={`atividade-row-${a.id}`}
    >
      <div className="flex items-center gap-1">
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
          className={`flex-1 min-w-0 flex items-center gap-1.5 text-left rounded-lg px-1.5 py-2 cursor-pointer transition-colors duration-150 ${
            expanded ? 'bg-slate-50' : 'hover:bg-slate-50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`text-slate-400 text-[10px] shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          >
            ▸
          </span>
          {isPending && (
            <span
              aria-hidden="true"
              title="Faltam informações (prazo ou responsável)"
              className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
            />
          )}
          <span
            className={`flex-1 min-w-0 truncate text-xs ${isDone ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}
          >
            {a.name || (a.kind === 'extra' ? 'Atividade extra sem nome' : 'Atividade sem nome')}
          </span>
          {a.kind === 'extra' && (
            <span className="text-[9px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 shrink-0">
              Extra
            </span>
          )}
          <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
            {a.plannedStart && a.plannedEnd
              ? `${shortDayMonth(a.plannedStart)} até ${shortDayMonth(a.plannedEnd)}`
              : 'Prazo não definido'}
          </span>
          {a.raciAccountableName?.trim() && (
            <span className="text-[10px] text-slate-400 shrink-0 hidden md:inline truncate max-w-[100px]">
              {a.raciAccountableName}
            </span>
          )}
          {isDone && <AheadBehindBadge atividade={a} />}
          <StatusBadge atividade={a} />
        </div>
        {isDone && projects.length > 0 && (
          <>
            {projects.length > 1 && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Projeto para inserir a entrega"
                className={`text-[10px] px-1 shrink-0 max-w-[90px] ${INPUT_CLASS}`}
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

      {/* Animated via CSS grid (0fr -> 1fr), not a JS-measured height — the
         standard way to smoothly transition to "auto" height. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 mt-1 text-xs">
            {/* Only the actually-expanded row mounts the editable inputs —
               with 0fr/1fr driving the visual collapse, every row's panel
               stays in the DOM regardless of `expanded`, so gating on
               `editMode` alone would mount N sets of same-labeled inputs
               (duplicate ids/labels, focusable while visually hidden). The
               collapsed rows always render the harmless read-only <dl>
               instead. */}
            {editMode && expanded ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Nome:</span>
                  <input
                    value={nameValue}
                    onChange={(e) => onDraftChange(a.id, { name: e.target.value })}
                    placeholder={a.kind === 'extra' ? 'Nome da atividade extra' : 'Nome da atividade'}
                    aria-label={a.kind === 'extra' ? 'Nome da atividade extra' : 'Nome da atividade'}
                    className={`flex-1 min-w-[120px] ${INPUT_CLASS}`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Status:</span>
                  <select
                    value={statusValue}
                    onChange={(e) => {
                      const status = e.target.value as ActivityStatus;
                      onDraftChange(a.id, {
                        status,
                        completedAt: status === 'done' ? (completedAtValue || todayISO()) : undefined,
                      });
                    }}
                    aria-label={`Status da atividade: ${a.name || 'sem nome'}`}
                    className={`${INPUT_CLASS} shrink-0`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {ITEM_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Prazo:</span>
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
                  {statusValue === 'done' && (
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
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Entrega:</span>
                  <select
                    value={objetivoIdValue}
                    onChange={(e) => onDraftChange(a.id, { objetivoId: e.target.value as ObjetivoId })}
                    aria-label={`Mover atividade para outra entrega — ${a.name || 'atividade'}`}
                    className={`${INPUT_CLASS} shrink-0`}
                  >
                    {objetivos.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.entregaLabel} — {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Responsável:</span>
                  <input
                    value={raciAccountableValue}
                    onChange={(e) => onDraftChange(a.id, { raciAccountableName: e.target.value })}
                    placeholder="Nome (Accountable)"
                    aria-label="Responsável (Accountable)"
                    className={`flex-1 min-w-[100px] ${INPUT_CLASS}`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 shrink-0 w-20">Executor:</span>
                  <input
                    value={raciResponsibleValue}
                    onChange={(e) => onDraftChange(a.id, { raciResponsibleName: e.target.value })}
                    placeholder="Nome (Responsible)"
                    aria-label="Executor (Responsible)"
                    className={`flex-1 min-w-[100px] ${INPUT_CLASS}`}
                  />
                </div>
                <textarea
                  value={noteValue}
                  onChange={(e) => onDraftChange(a.id, { note: e.target.value })}
                  placeholder="Anotação (opcional)"
                  aria-label="Anotação"
                  rows={2}
                  className={`${INPUT_CLASS} resize-none`}
                />
                {a.kind === 'extra' && !readOnly && (
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(true)}
                    className="self-start text-[11px] text-slate-400 hover:text-red-600 transition-colors"
                  >
                    Remover atividade extra
                  </button>
                )}
              </>
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>
                  <dt className="text-slate-400">Status</dt>
                  <dd className="text-slate-700 font-medium">{ITEM_STATUS_LABEL[visualStatus]}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Prazo</dt>
                  <dd className="text-slate-700 font-medium">
                    {a.plannedStart && a.plannedEnd ? (
                      `${shortDayMonth(a.plannedStart)} até ${shortDayMonth(a.plannedEnd)}`
                    ) : (
                      <span className="italic text-slate-400 font-normal">Não definido</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Responsável</dt>
                  <dd className="text-slate-700 font-medium">
                    {a.raciAccountableName?.trim() || <span className="italic text-slate-400 font-normal">Não atribuído</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Executor</dt>
                  <dd className="text-slate-700 font-medium">
                    {a.raciResponsibleName?.trim() || <span className="italic text-slate-400 font-normal">Não atribuído</span>}
                  </dd>
                </div>
                {isDone && (
                  <div>
                    <dt className="text-slate-400">Concluída em</dt>
                    <dd className="text-slate-700 font-medium">
                      {a.completedAt ? shortDayMonth(a.completedAt) : '—'}
                    </dd>
                  </div>
                )}
                <div className="col-span-2">
                  <dt className="text-slate-400">Entrega</dt>
                  <dd className="text-slate-700 font-medium">
                    {objetivos.find((o) => o.id === a.objetivoId)?.entregaLabel ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-400">Anotação</dt>
                  <dd className="text-slate-700 font-medium">
                    {a.note?.trim() || <span className="italic text-slate-400 font-normal">Nenhuma</span>}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

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
  objetivos: Objetivo[];
  atividades: Atividade[];
  projects: Project[];
  readOnly: boolean;
  onUpdateObjetivo: (id: ObjetivoId, patch: Partial<Objetivo>) => Promise<void>;
  onUpdateAtividade: (id: string, patch: AtividadePatch) => Promise<void>;
  onAddExtra: (objetivoId: ObjetivoId, name: string) => Promise<Atividade>;
  onRemoveExtra: (id: string) => Promise<void>;
  onInsertDelivery: (projectId: string, text: string) => void;
  /** Set only for the one ObjetivoCard that should auto-open in edit mode
   *  and scroll itself into view (see FocusAtividade on the top-level Props). */
  focusAtividadeId?: string | null;
  onFocusHandled?: () => void;
}

function ObjetivoCard({
  objetivo,
  objetivos,
  atividades,
  projects,
  readOnly,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtra,
  onRemoveExtra,
  onInsertDelivery,
  focusAtividadeId,
  onFocusHandled,
}: ObjetivoCardProps) {
  const { showToast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState(objetivo.name);
  const [draftEntregaLabel, setDraftEntregaLabel] = useState(objetivo.entregaLabel);
  const [draftPeriodStart, setDraftPeriodStart] = useState(objetivo.periodStart);
  const [draftPeriodEnd, setDraftPeriodEnd] = useState(objetivo.periodEnd);
  const [error, setError] = useState('');
  // Accordion + list edit-mode — independent from the objetivo header's own
  // `editing` above (which only covers name/entregaLabel/período): only one
  // item expanded at a time, and whether the expanded item's fields render
  // as text or as inputs is this separate `itemsEditMode` toggle.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsEditMode, setItemsEditMode] = useState(false);
  const [savingItems, setSavingItems] = useState(false);
  const [draftActivities, setDraftActivities] = useState<Record<string, ActivityDraft>>({});
  const [itemsError, setItemsError] = useState('');
  const [addingExtra, setAddingExtra] = useState(false);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraStart, setNewExtraStart] = useState('');
  const [newExtraEnd, setNewExtraEnd] = useState('');
  const [addExtraError, setAddExtraError] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const items = atividadesForObjetivo(objetivo.id, atividades);
  const progress = computeObjetivoProgress(objetivo.id, atividades);
  const aheadBehind = computeObjetivoAheadBehind(objetivo.id, atividades);
  const week = currentWeekOfObjetivo(objetivo);
  const progressBarColor = STATUS_META.on_track.color;

  useEffect(() => {
    if (!focusAtividadeId) return;
    setExpandedId(focusAtividadeId);
    setItemsEditMode(true);
    setHighlightedId(focusAtividadeId);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    onFocusHandled?.();
    const timer = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAtividadeId]);

  function startEditing() {
    setDraftName(objetivo.name);
    setDraftEntregaLabel(objetivo.entregaLabel);
    setDraftPeriodStart(objetivo.periodStart);
    setDraftPeriodEnd(objetivo.periodEnd);
    setError('');
    setEditing(true);
  }

  function cancelEditing() {
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

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  /** Persists every pending item draft at once (accumulated across
   *  however many items were opened/edited while itemsEditMode was on —
   *  the accordion only limits what's VISIBLE at a time, not how many
   *  drafts can be pending), then returns the list to read mode. Same
   *  validation the old bulk-edit save had: no empty names on planned
   *  items, start < end, and a reason required when replanning an
   *  already-set date (Bloco 1.2 governance rule). */
  async function saveItemEdits() {
    const plannedItems = items.filter((a) => a.kind === 'planned');
    for (const a of plannedItems) {
      const draftedName = draftActivities[a.id]?.name;
      const effective = (draftedName ?? a.name).trim();
      if (!effective) {
        setItemsError('Nenhuma atividade pode ficar com o nome vazio.');
        return;
      }
    }
    for (const a of items) {
      const draft = draftActivities[a.id];
      if (!draft) continue;
      const plannedStart = draft.plannedStart ?? a.plannedStart;
      const plannedEnd = draft.plannedEnd ?? a.plannedEnd;
      if (plannedStart && plannedEnd && !(plannedStart < plannedEnd)) {
        setItemsError(`"${a.name || 'Atividade'}": a data de início planejada deve ser anterior à data de fim planejada.`);
        return;
      }
      const replanning =
        (!!a.plannedStart && draft.plannedStart !== undefined && draft.plannedStart !== a.plannedStart) ||
        (!!a.plannedEnd && draft.plannedEnd !== undefined && draft.plannedEnd !== a.plannedEnd);
      if (replanning && !draft.reason?.trim()) {
        setItemsError(`"${a.name || 'Atividade'}": informe o motivo da mudança para replanejar a data.`);
        return;
      }
    }

    setSavingItems(true);
    setItemsError('');
    try {
      for (const a of items) {
        const draft = draftActivities[a.id];
        if (!draft) continue;
        const patch: AtividadePatch = {};
        if (draft.name !== undefined && draft.name.trim() !== a.name) patch.name = draft.name.trim();
        if (draft.note !== undefined && draft.note !== (a.note ?? '')) patch.note = draft.note || null;
        if (draft.status !== undefined && draft.status !== a.status) patch.status = draft.status;
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
        if (draft.objetivoId !== undefined && draft.objetivoId !== a.objetivoId) patch.objetivoId = draft.objetivoId;
        if (draft.reason?.trim()) patch.reason = draft.reason.trim();
        if (Object.keys(patch).length > 0) await onUpdateAtividade(a.id, patch);
      }
      setDraftActivities({});
      setItemsEditMode(false);
      showToast('Alterações salvas.');
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSavingItems(false);
    }
  }

  function cancelItemEdits() {
    setDraftActivities({});
    setItemsError('');
    setItemsEditMode(false);
  }

  async function handleAddExtra() {
    const name = newExtraName.trim();
    if (!name) return;
    if ((newExtraStart && !newExtraEnd) || (!newExtraStart && newExtraEnd)) {
      setAddExtraError('Informe início e fim do prazo juntos, ou deixe os dois em branco.');
      return;
    }
    if (newExtraStart && newExtraEnd && !(newExtraStart < newExtraEnd)) {
      setAddExtraError('A data de início deve ser anterior à data de fim.');
      return;
    }
    setAddExtraError('');
    try {
      const created = await onAddExtra(objetivo.id, name);
      if (newExtraStart && newExtraEnd) {
        await onUpdateAtividade(created.id, { plannedStart: newExtraStart, plannedEnd: newExtraEnd });
      }
      setNewExtraName('');
      setNewExtraStart('');
      setNewExtraEnd('');
      setAddingExtra(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível adicionar a atividade.', 'error');
    }
  }

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      data-testid={`objetivo-card-${objetivo.id}`}
    >
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
                ✎ Editar entrega
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
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%`, backgroundColor: progressBarColor }}
            />
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
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-slate-400">
              {items.length} {items.length === 1 ? 'atividade' : 'atividades'}
            </p>
            {!readOnly && (
              <div className="flex items-center gap-2">
                {itemsEditMode && (
                  <button
                    type="button"
                    onClick={cancelItemEdits}
                    disabled={savingItems}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (itemsEditMode ? void saveItemEdits() : setItemsEditMode(true))}
                  disabled={savingItems}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded px-2 py-1 transition-colors disabled:opacity-50"
                >
                  {itemsEditMode ? (savingItems ? 'Salvando…' : 'Concluir edição') : 'Editar'}
                </button>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {items.map((a) => (
              <AtividadeRow
                key={a.id}
                atividade={a}
                objetivos={objetivos}
                projects={projects}
                readOnly={readOnly}
                expanded={a.id === expandedId}
                editMode={itemsEditMode}
                highlighted={a.id === highlightedId}
                draft={draftActivities[a.id]}
                onToggleExpand={() => toggleExpand(a.id)}
                onDraftChange={updateDraftActivity}
                onRemove={onRemoveExtra}
                onInsertDelivery={onInsertDelivery}
              />
            ))}
          </div>
          {itemsError && <p className="text-[11px] font-medium text-red-600">{itemsError}</p>}
        </>
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
          <div className="flex flex-col gap-1.5">
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
                    setNewExtraStart('');
                    setNewExtraEnd('');
                    setAddExtraError('');
                  }
                }}
                placeholder="Nome da atividade extra"
                aria-label="Nome da nova atividade extra"
                className={`flex-1 ${INPUT_CLASS}`}
              />
              <button
                type="button"
                onClick={() => void handleAddExtra()}
                className="text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors shrink-0"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400 shrink-0">
                Prazo (opcional — para já aparecer na Roadmap Timeline):
              </span>
              <input
                type="date"
                value={newExtraStart}
                onChange={(e) => setNewExtraStart(e.target.value)}
                aria-label="Início planejado da nova atividade extra"
                className={`${INPUT_CLASS} shrink-0`}
              />
              <span className="text-[10px] text-slate-400 shrink-0">até</span>
              <input
                type="date"
                value={newExtraEnd}
                onChange={(e) => setNewExtraEnd(e.target.value)}
                aria-label="Fim planejado da nova atividade extra"
                className={`${INPUT_CLASS} shrink-0`}
              />
            </div>
            {addExtraError && <p className="text-[11px] font-medium text-red-600">{addExtraError}</p>}
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
  currentWeekStart,
  projects,
  readOnly,
  onInsertDelivery,
  onUpdateObjetivo,
  onUpdateAtividade,
  onAddExtra,
  onRemoveExtra,
  focusAtividade,
  onFocusHandled,
}: Props) {
  if (objetivos.length === 0) {
    return <p className="text-sm text-slate-400 italic">Carregando roadmap…</p>;
  }

  const visibleAtividades = atividades.filter((a) => isVisibleThisWeek(a, currentWeekStart));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {objetivos.map((objetivo) => (
        <ObjetivoCard
          key={objetivo.id}
          objetivo={objetivo}
          objetivos={objetivos}
          atividades={visibleAtividades}
          projects={projects}
          readOnly={readOnly}
          onUpdateObjetivo={onUpdateObjetivo}
          onUpdateAtividade={onUpdateAtividade}
          onAddExtra={onAddExtra}
          onRemoveExtra={onRemoveExtra}
          onInsertDelivery={onInsertDelivery}
          focusAtividadeId={focusAtividade?.objetivoId === objetivo.id ? focusAtividade.atividadeId : null}
          onFocusHandled={onFocusHandled}
        />
      ))}
    </div>
  );
}
