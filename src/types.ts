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
  completedAt?: string; // ISO date, set when status -> 'done'
}

export const ACTIVITY_STATUS_META: Record<ActivityStatus, { label: string }> = {
  planned: { label: 'Planejada' },
  in_progress: { label: 'Em andamento' },
  done: { label: 'Concluída' },
};

// --- Roadmap: frozen per-report progress snapshot ---
export interface ObjetivoProgressSnapshot {
  objetivoId: ObjetivoId;
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
