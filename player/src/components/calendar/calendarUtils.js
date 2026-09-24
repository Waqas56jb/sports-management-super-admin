import { addDays, toISODate } from '@/utils/formatters';

export const WEEK_STARTS_ON = 1; // Monday

export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(d, -diff);
}

export function monthGrid(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Date range to fetch for a view. */
export function calendarRange(view, date) {
  if (view === 'month') {
    const grid = monthGrid(date);
    return { from: toISODate(grid[0]), to: toISODate(grid[41]) };
  }
  if (view === 'week') {
    const days = weekDays(date);
    return { from: toISODate(days[0]), to: toISODate(days[6]) };
  }
  const iso = toISODate(date);
  return { from: iso, to: iso };
}

export function shiftDate(view, date, dir) {
  if (view === 'month') return new Date(date.getFullYear(), date.getMonth() + dir, 1);
  if (view === 'week') return addDays(date, 7 * dir);
  return addDays(date, dir);
}
