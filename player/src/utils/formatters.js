const LOCALES = { en: 'en-GB', fr: 'fr-FR' };

export const localeOf = (lang) => LOCALES[lang] || lang;

/** Parse 'YYYY-MM-DD' (optionally with 'HH:mm') as a local date — avoids UTC shifts. */
export function parseDate(date, time) {
  if (!date) return null;
  if (date instanceof Date) return date;
  const s = String(date);
  if (s.length > 10) return new Date(s);
  const [y, m, d] = s.split('-').map(Number);
  const [hh = 0, mm = 0] = time ? time.split(':').map(Number) : [];
  return new Date(y, m - 1, d, hh, mm);
}

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(date, lang = 'en', opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = parseDate(date);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(localeOf(lang), opts).format(d);
}

export function formatShortDate(date, lang = 'en') {
  return formatDate(date, lang, { day: 'numeric', month: 'short' });
}

export function formatWeekday(date, lang = 'en') {
  return formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatLongDate(date, lang = 'en') {
  return formatDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso, lang = 'en') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(localeOf(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(time) {
  return time ? time.slice(0, 5) : '—';
}

export function formatNumber(value, lang = 'en', opts) {
  return new Intl.NumberFormat(localeOf(lang), opts).format(value ?? 0);
}

export function formatPercent(value, lang = 'en') {
  return `${formatNumber(Math.round(value ?? 0), lang)}${lang === 'fr' ? ' ' : ''}%`;
}

/** Relative time ("3 hours ago") using Intl.RelativeTimeFormat. */
export function formatRelative(iso, lang = 'en') {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(Math.round(diff), 'second');
}

export function ageFrom(dob) {
  const d = parseDate(dob);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Minutes between two 'HH:mm' strings. */
export function durationMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** "Today", "Tomorrow", "Yesterday" or a short weekday date. */
export function formatRelativeDay(date, lang = 'en', t) {
  const d = parseDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (t && diff === 0) return t('common.today');
  if (t && diff === 1) return t('common.tomorrow');
  if (t && diff === -1) return t('common.yesterday');
  return formatWeekday(date, lang);
}

/** Countdown parts until a date + 'HH:mm'. Returns null once the time has passed. */
export function countdown(date, time) {
  const target = parseDate(date, time).getTime();
  const ms = target - Date.now();
  if (ms <= 0) return null;
  return { days: Math.floor(ms / 86400000), hours: Math.floor((ms % 86400000) / 3600000), minutes: Math.floor((ms % 3600000) / 60000) };
}

/** Localised country name from an ISO code ("DJ" → "Djibouti"). */
export function countryName(code, lang = 'en') {
  if (!code) return '—';
  try {
    return new Intl.DisplayNames([localeOf(lang)], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
