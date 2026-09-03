import type { Report } from '../types';

const REPORTS_PREFIX = 'wsr:reports:';

export function getReports(userId: string): Report[] {
  const raw = localStorage.getItem(REPORTS_PREFIX + userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Report[];
    return parsed
      .map((r) => ({ ...r, nextSteps: r.nextSteps ?? '' })) // migration: old reports predate this field
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  } catch {
    return [];
  }
}

export function saveReport(report: Report) {
  const reports = getReports(report.userId);
  const idx = reports.findIndex((r) => r.id === report.id);
  if (idx >= 0) {
    reports[idx] = report;
  } else {
    reports.push(report);
  }
  localStorage.setItem(REPORTS_PREFIX + report.userId, JSON.stringify(reports));
}

export function deleteReport(userId: string, reportId: string) {
  const reports = getReports(userId).filter((r) => r.id !== reportId);
  localStorage.setItem(REPORTS_PREFIX + userId, JSON.stringify(reports));
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
