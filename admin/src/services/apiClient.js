/**
 * HTTP client for the future `server/` REST API.
 *
 * While VITE_USE_MOCK_API is not "false", every service resolves against the in-browser
 * mock database instead (services/mock). Flipping the flag routes the exact same service
 * calls through `api.*` below — the UI does not change.
 */
import { authStorage } from './authStorage';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

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

  if (response.status === 401) {
    authStorage.clear();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.code ?? 'errors.generic', {
      status: response.status,
      fields: payload?.fields ?? null,
      message: payload?.message,
    });
  }
  return payload;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};
