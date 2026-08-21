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
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  area: string;
  responsible: string;
}

export const STATUS_META: Record<ProjectStatus, { label: string; color: string; dot: string }> = {
  on_track: { label: 'No prazo', color: '#15803d', dot: 'bg-emerald-500' },
  attention: { label: 'Atenção', color: '#b45309', dot: 'bg-amber-500' },
  delayed: { label: 'Atrasado', color: '#b91c1c', dot: 'bg-red-500' },
};
