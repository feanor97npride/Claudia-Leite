import { mondayOf, toISODate } from '../utils/date';

/**
 * Generic replacement for the Roadmap Timeline's old month-only column
 * model (Fase 4 — zoom temporal): a "period" is one column of the Gantt,
 * whatever its granularity. Every zoom level reduces to the same shape —
 * an ordered list of non-overlapping [start,end] date ranges — so the rest
 * of RoadmapTimeline (bar placement, the "hoje" marker) doesn't need to
 * know which zoom level is active.
 */
export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export interface Period {
  key: string;
  label: string;
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
}

/** Display label + a minimum column width per level — day/week need many
 *  more columns than month/quarter, so they start narrower. */
export const ZOOM_LEVEL_META: Record<ZoomLevel, { label: string; minColWidth: number }> = {
  day: { label: 'Dia', minColWidth: 28 },
  week: { label: 'Semana', minColWidth: 44 },
  month: { label: 'Mês', minColWidth: 56 },
  quarter: { label: 'Trimestre', minColWidth: 72 },
};

const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function lastDayOfMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

function buildDayPeriods(startISO: string, endISO: string): Period[] {
  const periods: Period[] = [];
  let cur = startISO;
  while (cur <= endISO) {
    const d = new Date(cur + 'T00:00:00');
    periods.push({ key: cur, label: String(d.getDate()), start: cur, end: cur });
    cur = addDays(cur, 1);
  }
  return periods;
}

function buildWeekPeriods(startISO: string, endISO: string): Period[] {
  const periods: Period[] = [];
  let weekStart = toISODate(mondayOf(new Date(startISO + 'T00:00:00')));
  while (weekStart <= endISO) {
    const weekEnd = addDays(weekStart, 6);
    const d = new Date(weekStart + 'T00:00:00');
    periods.push({
      key: weekStart,
      label: `${String(d.getDate()).padStart(2, '0')}/${MONTH_ABBR[d.getMonth()]}`,
      start: weekStart,
      end: weekEnd,
    });
    weekStart = addDays(weekStart, 7);
  }
  return periods;
}

function buildMonthPeriods(startISO: string, endISO: string): Period[] {
  const periods: Period[] = [];
  let y = Number(startISO.slice(0, 4));
  let m = Number(startISO.slice(5, 7));
  const endY = Number(endISO.slice(0, 4));
  const endM = Number(endISO.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    periods.push({
      key,
      label: `${MONTH_ABBR[m - 1]}/${String(y).slice(2)}`,
      start: `${key}-01`,
      end: `${key}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return periods;
}

function buildQuarterPeriods(startISO: string, endISO: string): Period[] {
  const periods: Period[] = [];
  let y = Number(startISO.slice(0, 4));
  let q = Math.ceil(Number(startISO.slice(5, 7)) / 3);
  const endY = Number(endISO.slice(0, 4));
  const endQ = Math.ceil(Number(endISO.slice(5, 7)) / 3);
  while (y < endY || (y === endY && q <= endQ)) {
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    periods.push({
      key: `${y}-Q${q}`,
      label: `T${q}/${String(y).slice(2)}`,
      start: `${y}-${String(startMonth).padStart(2, '0')}-01`,
      end: `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDayOfMonth(y, endMonth)).padStart(2, '0')}`,
    });
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }
  return periods;
}

export function buildPeriods(zoom: ZoomLevel, rangeStartISO: string, rangeEndISO: string): Period[] {
  switch (zoom) {
    case 'day':
      return buildDayPeriods(rangeStartISO, rangeEndISO);
    case 'week':
      return buildWeekPeriods(rangeStartISO, rangeEndISO);
    case 'quarter':
      return buildQuarterPeriods(rangeStartISO, rangeEndISO);
    case 'month':
      return buildMonthPeriods(rangeStartISO, rangeEndISO);
  }
}

/**
 * Which columns (0-based, inclusive span) an atividade's planned range
 * occupies, given the periods for the current zoom level — same semantics
 * as the old month-only monthColumnRange, generalized to any granularity:
 * clamps to the visible range if the planned dates fall outside it, rather
 * than failing to render the bar at all.
 */
export function periodColumnRange(
  plannedStart: string,
  plannedEnd: string,
  periods: Period[],
): { startIdx: number; span: number } | null {
  if (periods.length === 0) return null;
  const startFound = periods.findIndex((p) => plannedStart >= p.start && plannedStart <= p.end);
  const endFound = periods.findIndex((p) => plannedEnd >= p.start && plannedEnd <= p.end);
  if (startFound === -1 && endFound === -1) return null;
  const startIdx = startFound === -1 ? 0 : startFound;
  const endIdx = endFound === -1 ? periods.length - 1 : endFound;
  return { startIdx, span: Math.max(1, endIdx - startIdx + 1) };
}

/** Index + fractional position of `todayISO` within its own period, for
 *  the vertical "hoje" marker — null when today falls outside the
 *  displayed range entirely. */
export function todayPeriodPosition(periods: Period[], todayISO: string): { idx: number; fraction: number } | null {
  const idx = periods.findIndex((p) => todayISO >= p.start && todayISO <= p.end);
  if (idx === -1) return null;
  const period = periods[idx];
  const startMs = new Date(period.start + 'T00:00:00').getTime();
  const endMs = new Date(period.end + 'T00:00:00').getTime();
  const totalDays = Math.round((endMs - startMs) / DAY_MS) + 1;
  const elapsedDays = Math.round((new Date(todayISO + 'T00:00:00').getTime() - startMs) / DAY_MS);
  return { idx, fraction: totalDays > 0 ? elapsedDays / totalDays : 0 };
}
