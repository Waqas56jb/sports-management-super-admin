/**
 * Date helpers. The process runs in APP_TIMEZONE (set in config/env.js), so "today", match days
 * and training days follow the federation's local calendar regardless of the host's time zone.
 * Calendar dates travel as 'YYYY-MM-DD' strings, times as 'HH:MM', instants as ISO-8601 UTC.
 */

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const todayISO = () => toISODate(new Date());

export const daysFromToday = (days) => toISODate(addDays(new Date(), days));

/** 'YYYY-MM-DD' → local Date at midnight. */
export function parseDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the ISO week containing `iso`. */
export function mondayOf(iso) {
  const d = parseDate(iso);
  return toISODate(addDays(d, -((d.getDay() + 6) % 7)));
}

/** 'HH:MM:SS' (PostgreSQL time) → 'HH:MM'. */
export const hhmm = (t) => (t ? String(t).slice(0, 5) : t);

export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const d = parseDate(value);
  return toISODate(d) === value;
}

/** English long date used in stored notification text ("Thursday 24 September"). */
export function formatLongDate(iso) {
  if (!iso) return '';
  return parseDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
