/**
 * Centralised API base URL.
 * In development:  http://localhost:3001  (set via .env.local)
 * In production:   your deployed backend URL (set as Vercel env var)
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

export const api = {
  get:    (path)         => fetch(`${API_BASE}${path}`),
  post:   (path, body)   => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }),
  patch:  (path, body)   => fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }),
  delete: (path)         => fetch(`${API_BASE}${path}`, { method: 'DELETE' }),
  upload: (path, formData) => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData          // no Content-Type header — browser sets it with boundary
  }),
}
