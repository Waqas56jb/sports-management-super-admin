/**
 * Consistent response envelope:
 *   { success: true, message, data }                                   single resource / object
 *   { success: true, message, data: [...], pagination: {...}, meta }   paginated lists
 */
export function ok(res, data, message = 'OK', { status = 200, pagination, meta } = {}) {
  const body = { success: true, message, data: data ?? null };
  if (pagination) body.pagination = pagination;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export const created = (res, data, message = 'Created successfully') => ok(res, data, message, { status: 201 });

/** Sends a service result of shape { rows, pagination, meta? } as a paginated list. */
export const paged = (res, result, message = 'Retrieved successfully') =>
  ok(res, result.rows, message, { pagination: result.pagination, meta: result.meta });

export const noContent = (res) => res.status(204).end();
