// Server-side mirror of the equivalent pure functions in src/utils/date.ts.
// Duplicated deliberately rather than imported: src/ is bundled for the
// browser by Vite, server/ runs under plain Node on Vercel — keeping them
// separate avoids entangling the two build targets over a few small
// date-math functions.

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeTotalWeeks(periodStart: string, periodEnd: string): number {
  const start = mondayOf(new Date(periodStart + 'T00:00:00'));
  const end = mondayOf(new Date(periodEnd + 'T00:00:00'));
  const diffWeeks = Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, diffWeeks);
}

export function currentWeekOfObjetivo(periodStart: string, totalWeeks: number, today: Date = new Date()): number {
  const start = mondayOf(new Date(periodStart + 'T00:00:00'));
  const current = mondayOf(today);
  const diffWeeks = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.min(totalWeeks, Math.max(1, diffWeeks));
}

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthYearAbbr(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH_ABBR[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatObjetivoPeriodLabel(periodStart: string, periodEnd: string): string {
  return `${monthYearAbbr(periodStart)} a ${monthYearAbbr(periodEnd)}`;
}

export function todayISO(): string {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
