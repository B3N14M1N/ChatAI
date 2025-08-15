// Default to '/api' so dev server proxy (vite.config.ts) forwards to backend when
// VITE_API_BASE is not set in the environment.
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
  // Normalize URL
  let url: string;
  if (typeof input === 'string') url = input;
  else if (input instanceof Request) url = input.url;
  else url = String(input);

  // If absolute URL, do nothing. If relative root path, prefix with API_BASE
  // but avoid duplicating when url already starts with the base (e.g., '/api/...').
  const isAbsolute = /^https?:\/\//i.test(url);
  if (!isAbsolute && url.startsWith('/')) {
    if (API_BASE) {
      if (API_BASE.startsWith('http')) {
        url = `${API_BASE}${url}`;
      } else if (!url.startsWith(API_BASE.endsWith('/') ? API_BASE : API_BASE + '/')) {
        url = `${API_BASE}${url}`;
      }
    }
  }

  // Merge headers and attach Authorization if token exists
  const token = localStorage.getItem('authToken');
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const merged: RequestInit = { ...init, headers };
  return fetch(url, merged);
}

export async function fetchJson<T = any>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export default { apiFetch, fetchJson };
