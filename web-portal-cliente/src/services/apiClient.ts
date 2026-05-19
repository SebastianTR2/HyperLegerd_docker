import { clearAuthToken, getAuthToken } from '../lib/authStorage'
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

export const PORTAL_API_PREFIX = '/portal-api'

type PortalFetchInit = RequestInit & { skipAuth?: boolean }

export async function portalFetch(path: string, init: PortalFetchInit = {}): Promise<Response> {
  const url = path.startsWith('http')
    ? path
    : `${PORTAL_API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers ?? undefined)
  if (!init.skipAuth) {
    const token = getAuthToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const { headers: _h, skipAuth: _s, ...rest } = init
  const res = await fetch(url, { ...rest, headers })
  if (res.status === 401 && !init.skipAuth) {
    clearAuthToken()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
  }
  return res
}

export async function portalJson<T>(path: string, init: PortalFetchInit = {}): Promise<T> {
  const res = await portalFetch(path, init)
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
      } else if (typeof o.mensaje === 'string') {
        errBody = { ok: false, codigo: 'ERROR', mensaje: o.mensaje }
      }
    }
    throw new ApiHttpError(res.status, errBody, errBody?.mensaje)
  }

  return parsed as T
}

/** Alias para servicios de clientes (mismo BFF). */
export const apiFetch = portalFetch
export const apiJson = portalJson
