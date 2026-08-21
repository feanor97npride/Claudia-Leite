import type { Project, Report, UserProfile } from '../types';
import { currentWeekStartISO, formatPeriodLabel, nextWeekStartISO } from '../utils/date';
import { newId } from './storage';

export function blankProject(): Project {
  return {
    id: newId(),
    name: '',
    status: 'on_track',
    percent: 0,
    deliveries: '',
    nextWeekAdvances: '',
    nextSteps: '',
    risks: '',
  };
}

export function blankReport(profile: UserProfile): Report {
  const weekStart = currentWeekStartISO();
  const now = new Date().toISOString();
  return {
    id: newId(),
    userId: profile.userId,
    periodLabel: formatPeriodLabel(weekStart),
    weekStart,
    area: profile.area,
    responsible: profile.responsible,
    execSummary: '',
    projects: [blankProject()],
    indicators: [],
    highlights: '',
    attentionPoints: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** Duplicates a report as the starting point for the following week. */
export function duplicateForNextWeek(source: Report): Report {
  const weekStart = nextWeekStartISO(source.weekStart);
  const now = new Date().toISOString();
  return {
    ...source,
    id: newId(),
    weekStart,
    periodLabel: formatPeriodLabel(weekStart),
    createdAt: now,
    updatedAt: now,
    projects: source.projects.map((p) => ({
      ...p,
      id: newId(),
      // Advances started early become the natural starting point for the new week's deliveries.
      deliveries: p.nextWeekAdvances,
      nextWeekAdvances: '',
    })),
  };
}
