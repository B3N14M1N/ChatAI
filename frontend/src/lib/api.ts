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
    
    // Log the full error to console for debugging
    console.error('API Error:', {
      status: res.status,
      statusText: res.statusText,
      url: res.url,
      response: text
    });

    // Try to parse the error response as JSON
    let errorMessage = `HTTP error ${res.status}`;
    
    try {
      const errorData = JSON.parse(text);
      
      // Handle different error response formats
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData.detail) {
        // FastAPI style error response
        errorMessage = errorData.detail;
      } else if (errorData.message) {
        // Generic message field
        errorMessage = errorData.message;
      } else if (errorData.error) {
        // Error field
        errorMessage = errorData.error;
      } else if (Array.isArray(errorData)) {
        // Handle validation errors (array of error objects)
        errorMessage = errorData.map(err => err.msg || err.message || String(err)).join(', ');
      } else {
        // Fallback: stringify the error object
        errorMessage = JSON.stringify(errorData);
      }
    } catch (parseError) {
      // If parsing fails, use the raw text or a generic message
      errorMessage = text || `HTTP error ${res.status}`;
    }
    
    throw new Error(errorMessage);
  }
  return res.json() as Promise<T>;
}

export default { apiFetch, fetchJson };
