export type ProjectStatus = 'on_track' | 'attention' | 'delayed';

export interface Indicator {
  id: string;
  label: string;
  value: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  percent: number;
  deliveries: string;
  nextWeekAdvances: string;
  nextSteps: string;
  risks: string;
  /** Set only when this Project/Iniciativa was created from "+ Adicionar
   *  atividade extra" with the "vincular" option checked — purely a origin
   *  marker (shown as a badge), never synced with the atividade's status:
   *  the two track different things (narrative vs. governed progress), see
   *  the app's own discussion of this in ReportEditor's section header. */
  linkedAtividadeId?: string;
  /** Optional planned start/end (ISO dates), set by hand in the Editor —
   *  when both are present, the Roadmap Timeline's "Atividades da Semana"
   *  group (Melhoria 2.1) draws a normal date-range bar for this item
   *  instead of falling back to a single-day point marker. */
  plannedStart?: string;
  plannedEnd?: string;
}

export interface Report {
  id: string;
  userId: string;
  periodLabel: string;
  weekStart: string; // ISO date (Monday of the reported week)
  area: string;
  responsible: string;
  execSummary: string;
  projects: Project[];
  indicators: Indicator[];
  highlights: string;
  attentionPoints: string;
  nextSteps: string;
  roadmapSnapshot?: RoadmapSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  area: string;
  responsible: string;
}

// --- Auth (system access role — Admin/Visualizador; unrelated to RACI above) ---
export type Role = 'admin' | 'viewer';

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

// --- Governance: audit trail entry (Bloco 1.1) ---
export type ChangeType = 'escopo' | 'prazo' | 'status' | 'outro';
export type AuditEntityType = 'objetivo' | 'atividade';

export interface AuditEntry {
  id: number;
  entityType: AuditEntityType;
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changeType: ChangeType;
  reason: string | null;
  userId: string | null;
  actorLabel: string;
  createdAt: string;
}

export interface ObjetivoVersion {
  id: string;
  objetivo_id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  total_weeks: number;
  changed_reason: string | null;
  changed_by: string | null;
  superseded_at: string;
}

// --- Roadmap: Objetivos (fixed quarters) ---
export type ObjetivoId = 'diagnostico' | 'governanca' | 'operacao' | 'estrategia_futura';

/** One fixed color per Objetivo, reused wherever an objetivo needs a visual
 *  identity (e.g. the timeline Gantt) — a single named source instead of
 *  each component picking its own shade. */
export const OBJETIVO_COLOR: Record<ObjetivoId, { bar: string; tint: string; text: string }> = {
  diagnostico: { bar: '#15803d', tint: '#e9f7ee', text: '#15803d' },
  governanca: { bar: '#1d4ed8', tint: '#eaefff', text: '#1e40af' },
  operacao: { bar: '#0d9488', tint: '#e6f6f4', text: '#0f766e' },
  estrategia_futura: { bar: '#f59e0b', tint: '#fef3e0', text: '#b45309' },
};

export interface Objetivo {
  id: ObjetivoId;
  name: string;
  entregaLabel: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  periodLabel: string;
  totalWeeks: number;
}

// --- Roadmap: Atividades (per-objetivo checklist items) ---
export type ActivityStatus = 'planned' | 'in_progress' | 'done';
export type ActivityKind = 'planned' | 'extra';

/** One checklist item inside an atividade's "Subtarefas" tab (Roadmap
 *  Timeline detail panel). `percent` is set by hand (0-100, not derived);
 *  when an atividade has 1+ subtasks, its own progress is the average of
 *  these instead of the elapsed-time proxy (see lib/roadmap.ts
 *  computeBarFillPercent). */
export interface Subtask {
  id: string;
  name: string;
  percent: number;
}

export interface Atividade {
  id: string;
  name: string;
  objetivoId: ObjetivoId;
  status: ActivityStatus;
  kind: ActivityKind;
  completedAt?: string; // ISO date — real completion date; auto-set when status -> 'done', manually editable
  note?: string; // free-text annotation, informational only — never affects progress % (shown as "Descrição" in the Timeline detail panel)
  plannedStart?: string; // ISO date — planned start, used only for the ahead/behind % calculation
  plannedEnd?: string; // ISO date — planned end, used only for the ahead/behind % calculation
  // RACI (descriptive only — unrelated to the system access role below)
  raciAccountableName?: string; // "Responsável"
  raciResponsibleName?: string; // "Executor"
  /** Week (Monday, ISO date) an EXTRA atividade was created in — undefined
   *  for planned atividades and for extras created before this field
   *  existed. Used only to hide extras from the live Roadmap editor once
   *  their week passes (see lib/roadmap.ts isVisibleThisWeek). */
  weekStart?: string;
  /** Checklist contributing to a computed progress % — see Subtask above.
   *  [] (the default) means "no subtasks", falling back to the existing
   *  elapsed-time-based fill. */
  subtasks: Subtask[];
  /** Hex color overriding the Objetivo's own color on the Timeline bar —
   *  for an atividade that visually bridges two Objetivos. undefined =
   *  use the Objetivo's color, the default for every atividade. */
  colorOverride?: string;
}

/** Partial update sent to PATCH /api/atividades/:id — nullable fields clear
 *  that column server-side; `reason` is required only when replanning an
 *  already-set planned date (Bloco 1.2), validated on the server. */
export interface AtividadePatch {
  name?: string;
  note?: string | null;
  status?: ActivityStatus;
  completedAt?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  raciAccountableName?: string | null;
  raciResponsibleName?: string | null;
  subtasks?: Subtask[];
  colorOverride?: string | null;
  /** Reassigns the atividade to a different Objetivo — audited like any
   *  other field (Bloco 1.1); the app's progress/timeline calcs need no
   *  special-casing since they simply filter atividades by objetivoId. */
  objetivoId?: ObjetivoId;
  reason?: string;
}

// --- Backlog: global, persistent items (not tied to any weekly report) ---
export type BacklogPriority = 'alta' | 'media' | 'baixa';
export type BacklogStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

export interface BacklogItem {
  id: string;
  name: string;
  /** null = "Sem categoria" — a backlog item doesn't have to relate to a
   *  formal Objetivo yet (that's the point of a less-structured backlog). */
  objetivoId: ObjetivoId | null;
  priority: BacklogPriority;
  status: BacklogStatus;
  /** ISO date, optional — most backlog items have no defined deadline. */
  estimatedDueDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Partial update sent to PATCH /api/backlog/:id. */
export interface BacklogItemPatch {
  name?: string;
  objetivoId?: ObjetivoId | null;
  priority?: BacklogPriority;
  status?: BacklogStatus;
  estimatedDueDate?: string | null;
}

export const BACKLOG_PRIORITY_META: Record<BacklogPriority, { label: string; color: string }> = {
  alta: { label: 'Alta', color: '#dc2626' },
  media: { label: 'Média', color: '#d97706' },
  baixa: { label: 'Baixa', color: '#64748b' },
};

export const BACKLOG_STATUS_META: Record<BacklogStatus, { label: string; color: string }> = {
  nao_iniciado: { label: 'Não iniciado', color: '#64748b' },
  em_andamento: { label: 'Em andamento', color: '#1d4ed8' },
  concluido: { label: 'Concluído', color: '#15803d' },
};

export const ACTIVITY_STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planejada' },
  in_progress: { label: 'Em andamento' },
  done: { label: 'Concluída' },
};

/** Roadmap Timeline's visual status — a 4th state ("atrasado") layered on
 *  top of ActivityStatus by DERIVING it (status !== 'done' && plannedEnd in
 *  the past), since the data model itself only has 3 native status values.
 *  See lib/roadmap.ts timelineVisualStatus for the derivation. */
export type TimelineVisualStatus = 'done' | 'in_progress' | 'atrasado' | 'planned';

/** Each color/text pair below was checked by hand (relative-luminance WCAG
 *  contrast, same method used for OBJETIVO_COLOR) to clear 4.5:1 — solid
 *  fills use white text, the "planned" outline uses dark text on a pale
 *  fill. `pattern: true` adds a subtle diagonal hatch (see RoadmapTimeline)
 *  so "em andamento" reads as textured, not just a flat color, without
 *  dropping below AA once the hatch is factored in (checked at its actual
 *  opacity, not just the base color). */
export const TIMELINE_STATUS_META: Record<
  TimelineVisualStatus,
  { label: string; bg: string; text: string; border?: string; pattern?: boolean }
> = {
  done: { label: 'Concluído', bg: '#15803d', text: '#ffffff' },
  in_progress: { label: 'Em andamento', bg: '#1d4ed8', text: '#ffffff', pattern: true },
  planned: { label: 'Não iniciado', bg: '#ffffff', text: '#334155', border: '#94a3b8' },
  atrasado: { label: 'Atrasado', bg: '#b91c1c', text: '#ffffff' },
};

// --- Roadmap: frozen per-report progress snapshot ---
export interface ObjetivoProgressSnapshot {
  objetivoId: ObjetivoId;
  // Display fields frozen at generation time, so a historical report keeps
  // showing the objetivo's name/label/period as they were then, even if the
  // live objetivo is renamed/rescheduled later. Optional for backward
  // compatibility with snapshots generated before this field existed.
  name?: string;
  entregaLabel?: string;
  periodLabel?: string;
  totalWeeks?: number;
  progress: number; // 0-100
  weekOfQuarter: number; // 1-totalWeeks
  completedPlanned: { id: string; name: string }[];
  completedExtra: { id: string; name: string }[];
}

export type RoadmapSnapshot = ObjetivoProgressSnapshot[];

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; dot: string; icon: 'check' | 'alert' | 'clock' }
> = {
  on_track: { label: 'No prazo', color: '#1f9d55', dot: 'bg-emerald-500', icon: 'check' },
  attention: { label: 'Atenção', color: '#d97706', dot: 'bg-amber-500', icon: 'alert' },
  delayed: { label: 'Atrasado', color: '#dc2626', dot: 'bg-red-500', icon: 'clock' },
};

/** Generic good/bad/neutral signal color, reused wherever a number needs a
 *  quick visual read (ahead/behind %, governance indicators, replan counts)
 *  — one definition instead of each component picking its own shades. */
export type Tone = 'good' | 'bad' | 'neutral';

export const TONE_META: Record<Tone, { text: string; bg: string }> = {
  good: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
  bad: { text: 'text-red-700', bg: 'bg-red-50' },
  neutral: { text: 'text-slate-600', bg: 'bg-slate-100' },
};

export const ROLE_META: Record<Role, { label: string }> = {
  admin: { label: 'Admin' },
  viewer: { label: 'Visualizador' },
};
