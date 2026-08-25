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

/**
 * Total weeks spanned by a date range, counted the same way as
 * currentWeekOfObjetivo (Monday-to-Monday), so that
 * currentWeekOfObjetivo({ periodStart, totalWeeks }, periodEnd) === totalWeeks.
 */
export function computeTotalWeeks(periodStart: string, periodEnd: string): number {
  const start = mondayOf(new Date(periodStart + 'T00:00:00'));
  const end = mondayOf(new Date(periodEnd + 'T00:00:00'));
  const diffWeeks = Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, diffWeeks);
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthYearAbbr(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_ABBR[d.getMonth()]}/${d.getFullYear()}`;
}

/** e.g. "ago/2026 a out/2026" */
export function formatObjetivoPeriodLabel(periodStart: string, periodEnd: string): string {
  return `${monthYearAbbr(periodStart)} a ${monthYearAbbr(periodEnd)}`;
}

/** Whether an ISO date falls within the 7-day window starting at weekStartISO. */
export function isWithinWeek(dateISO: string, weekStartISO: string): boolean {
  const d = new Date(dateISO + 'T00:00:00').getTime();
  const start = new Date(weekStartISO + 'T00:00:00').getTime();
  return d >= start && d <= start + 6 * 24 * 60 * 60 * 1000;
}

/** "2026-08-15" -> "2026-08" (used to bucket a date into a Gantt month column). */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "2026-08" -> "ago/26" */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_ABBR[m - 1]}/${String(y).slice(2)}`;
}

/** Every month key ("YYYY-MM") from startISO's month through endISO's month, inclusive. */
export function monthsBetween(startISO: string, endISO: string): string[] {
  let y = Number(startISO.slice(0, 4));
  let m = Number(startISO.slice(5, 7));
  const endY = Number(endISO.slice(0, 4));
  const endM = Number(endISO.slice(5, 7));
  const keys: string[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}
