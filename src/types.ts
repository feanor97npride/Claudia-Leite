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

export interface Atividade {
  id: string;
  name: string;
  objetivoId: ObjetivoId;
  status: ActivityStatus;
  kind: ActivityKind;
  completedAt?: string; // ISO date — real completion date; auto-set when status -> 'done', manually editable
  note?: string; // free-text annotation, informational only — never affects progress %
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
  reason?: string;
}

export const ACTIVITY_STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planejada' },
  in_progress: { label: 'Em andamento' },
  done: { label: 'Concluída' },
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
