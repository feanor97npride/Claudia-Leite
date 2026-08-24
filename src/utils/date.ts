import type { Objetivo } from '../types';

function toISODate(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function currentWeekStartISO(): string {
  return toISODate(mondayOf(new Date()));
}

export function nextWeekStartISO(weekStartISO: string): string {
  const d = new Date(weekStartISO + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return toISODate(d);
}

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
const DAY_MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatPeriodLabel(weekStartISO: string): string {
  const start = new Date(weekStartISO + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = sameMonth
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(start)
    : DAY_MONTH.format(start);
  const endStr = `${DAY_MONTH.format(end)} de ${end.getFullYear()}`;
  return `${startStr} a ${endStr}`;
}

export function formatShortDate(iso: string): string {
  return DAY_MONTH_SHORT.format(new Date(iso + 'T00:00:00'));
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Which week (1..totalWeeks) of the objetivo's quarter a given date falls in, clamped to range. */
export function currentWeekOfObjetivo(objetivo: Objetivo, today: Date = new Date()): number {
  const start = mondayOf(new Date(objetivo.periodStart + 'T00:00:00'));
  const current = mondayOf(today);
  const diffWeeks = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(objetivo.totalWeeks, Math.max(1, diffWeeks));
}

/** Whether an ISO date falls within the 7-day window starting at weekStartISO. */
export function isWithinWeek(dateISO: string, weekStartISO: string): boolean {
  const d = new Date(dateISO + 'T00:00:00').getTime();
  const start = new Date(weekStartISO + 'T00:00:00').getTime();
  return d >= start && d <= start + 6 * 24 * 60 * 60 * 1000;
}
