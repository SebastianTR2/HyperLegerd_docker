import { resolvePortalApiKey } from '../lib/settings'
import type { RespuestaError } from '../types/api'

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

export const API_PREFIX = '/api'

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers ?? undefined)
  const key = resolvePortalApiKey()
  if (key) {
    headers.set('X-API-Key', key)
  }
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const { headers: _h, ...rest } = init
  return fetch(url, { ...rest, headers })
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init)
  const text = await res.text()
  const parsed = text ? parseJsonSafe(text) : null

  if (!res.ok) {
    let errBody: RespuestaError | null = null
    if (parsed && typeof parsed === 'object' && parsed !== null) {
      const o = parsed as Record<string, unknown>
      if (o.ok === false && typeof o.codigo === 'string') {
        errBody = parsed as RespuestaError
      } else if (typeof o.codigo === 'string' && typeof o.mensaje === 'string') {
        errBody = { ok: false, codigo: o.codigo, mensaje: o.mensaje }
      }
    }
    throw new ApiHttpError(res.status, errBody, errBody?.mensaje)
  }

  return parsed as T
}
