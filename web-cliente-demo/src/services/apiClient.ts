import { getApiKeyStored } from '../lib/settings'
import type { RespuestaError } from '../types/api'

/** Prefijo relativo: en dev Vite proxy reenvía `/api` → backend sin CORS. */
export const API_PREFIX = '/api'

export class ApiHttpError extends Error {
  readonly status: number
  readonly payload: RespuestaError | null

  constructor(status: number, payload: RespuestaError | null, message?: string) {
    super(message ?? payload?.mensaje ?? `HTTP ${status}`)
    this.name = 'ApiHttpError'
    this.status = status
    this.payload = payload
  }
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers ?? undefined)
  const key = getApiKeyStored()
  if (key) {
    headers.set('X-API-Key', key)
  }
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  // No mezclar `init.headers` crudo con el objeto final: siempre el `Headers` ya unificado.
  const { headers: _h, ...rest } = init
  return fetch(url, { ...rest, headers })
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init)
  const text = await res.text()
  const parsed = text ? parseJsonSafe(text) : null

  if (!res.ok) {
    const errBody =
      parsed && typeof parsed === 'object' && parsed !== null && 'ok' in parsed && (parsed as RespuestaError).ok === false
        ? (parsed as RespuestaError)
        : null
    throw new ApiHttpError(res.status, errBody, errBody?.mensaje)
  }

  return parsed as T
}
