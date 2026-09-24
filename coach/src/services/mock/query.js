import { PAGE_SIZE } from '@/utils/constants';
import { normalize } from '@/utils/text';

export function matchesSearch(search, ...values) {
  if (!search) return true;
  const q = normalize(search.trim());
  return values.some((v) => normalize(v).includes(q));
}

export function sortBy(list, key, dir = 'asc') {
  if (!key) return list;
  const factor = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
  });
}

/** Returns the standard list envelope used by every list endpoint. */
export function paginate(list, { page = 1, pageSize = PAGE_SIZE } = {}) {
  const total = list.length;
  const size = pageSize === 'all' ? Math.max(total, 1) : pageSize;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    data: list.slice((current - 1) * size, current * size),
    total,
    page: current,
    pageSize: size,
    pages,
  };
}

export function inDateRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
