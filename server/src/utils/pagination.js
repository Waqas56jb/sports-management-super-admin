import { PAGINATION } from '../config/constants.js';

/**
 * Normalises ?page=&limit= (also accepts the frontends' ?pageSize=; "all" means the maximum).
 * The limit is always capped at PAGINATION.maxLimit.
 */
export function parsePagination(q = {}, { defaultLimit = PAGINATION.defaultLimit } = {}) {
  const rawLimit = q.limit ?? q.pageSize;
  let limit = rawLimit === 'all' ? PAGINATION.maxLimit : Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(limit, PAGINATION.maxLimit);
  let page = Number.parseInt(q.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPagination(total, { page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page: Math.min(page, totalPages), limit, total, totalPages };
}

/** Paginates an already-filtered in-memory list (used for computed reports). */
export function paginateArray(list, q) {
  const p = parsePagination(q);
  const pagination = buildPagination(list.length, p);
  const start = (pagination.page - 1) * p.limit;
  return { rows: list.slice(start, start + p.limit), pagination };
}

/** Appends LIMIT/OFFSET placeholders to a parameter list and returns the SQL fragment. */
export function limitOffset(params, { limit, offset }) {
  params.push(limit, offset);
  return `LIMIT $${params.length - 1} OFFSET $${params.length}`;
}
