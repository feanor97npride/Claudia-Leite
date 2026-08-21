import type { Report, UserProfile } from '../types';

const CURRENT_USER_KEY = 'wsr:currentUser';
const PROFILE_PREFIX = 'wsr:profile:';
const REPORTS_PREFIX = 'wsr:reports:';

export function slugifyUser(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getCurrentUserId(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUserId(userId: string) {
  localStorage.setItem(CURRENT_USER_KEY, userId);
}

export function clearCurrentUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getProfile(userId: string): UserProfile | null {
  const raw = localStorage.getItem(PROFILE_PREFIX + userId);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem(PROFILE_PREFIX + profile.userId, JSON.stringify(profile));
}

export function getReports(userId: string): Report[] {
  const raw = localStorage.getItem(REPORTS_PREFIX + userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Report[];
    return parsed.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
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
