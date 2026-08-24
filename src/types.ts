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
