/**
 * HTTP client for the future `server/` REST API.
 *
 * Every service calls the REST API below. With VITE_USE_MOCK_API="true" the same service calls
 * resolve against the in-browser demo database instead (services/mock) — the UI does not change.
 */
import { authStorage } from './authStorage';

/** Production API (Railway). VITE_API_BASE_URL overrides it, e.g. http://localhost:5000/api/v1 for local work. */
const DEFAULT_API_BASE_URL = 'https://terrific-smile-production-85ea.up.railway.app/api/v1';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
/** The in-browser demo data is used only when VITE_USE_MOCK_API is explicitly "true". */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === 'true';

/** Error shape shared by the mock layer and the HTTP client. `code` is an i18n key. */
export class ApiError extends Error {
  constructor(code, { status = 400, fields = null, message } = {}) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  return url.toString();
}

async function request(method, path, { params, body } = {}) {
  const headers = { Accept: 'application/json' };
  const token = authStorage.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('errors.network', { status: 0 });
  }

  // An authenticated request rejected with 401 means the session expired or was revoked.
  // Login / logout themselves never trigger it (a wrong password is not an expired session).
  if (response.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/logout')) {
    authStorage.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    // API errors: { success: false, message, error: { code, i18nKey }, errors: [{ field, i18nKey }] }
    const fields = Array.isArray(payload?.errors)
      ? Object.fromEntries(payload.errors.filter((e) => e.field).map((e) => [e.field, e.i18nKey ?? 'errors.generic']))
      : null;
    throw new ApiError(payload?.error?.i18nKey ?? payload?.code ?? 'errors.generic', {
      status: response.status,
      fields: fields && Object.keys(fields).length ? fields : null,
      message: payload?.message,
    });
  }
  return unwrap(payload);
}

/**
 * Unwraps the API envelope. Paginated lists ({ data, pagination, meta }) become the list shape
 * the services use everywhere: { data, total, page, pageSize, pages, ...meta }.
 */
function unwrap(payload) {
  if (!payload || typeof payload !== 'object' || payload.success !== true) return payload;
  if (payload.pagination) {
    const { page, limit, total, totalPages } = payload.pagination;
    return { ...(payload.meta ?? {}), data: payload.data, total, page, pageSize: limit, pages: totalPages };
  }
  return payload.data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};
