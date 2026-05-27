// AuthContext gestiona la sesión de la consola del puente.
//
// El frontend nunca ve la X-API-Key real: el JWT obtenido tras el login
// la representa indirectamente (claims tenant + rol). Cada petición lleva
// `Authorization: Bearer <jwt>` y el BFF inyecta la X-API-Key al
// reenviar al api-middleware.
//
// Persistencia: el token se guarda en localStorage para sobrevivir a un
// refresh. Al expirar (401 desde el BFF) limpiamos el estado y forzamos
// re-login.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY_TOKEN = 'campuschain-admin-token'

/** Información del usuario logueado, derivada del backend. */
export interface UsuarioAdmin {
  usuario: string
  nombreCompleto: string
  rol: string
  tenant: string
}

interface LoginResponse {
  ok: boolean
  token: string
  usuario: UsuarioAdmin
}

interface MeResponse {
  ok: boolean
  usuario: UsuarioAdmin
}

interface ErrorResponse {
  ok: false
  codigo?: string
  mensaje?: string
}

export type EstadoAuth = 'verificando' | 'sin-sesion' | 'autenticado'

interface AuthValue {
  estado: EstadoAuth
  token: string | null
  usuario: UsuarioAdmin | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Lee el token actual sin pasar por hook (útil en utilidades imperativas). */
  obtenerToken: () => string | null
}

const AuthContext = createContext<AuthValue | null>(null)

/** Acceso imperativo al token (apiClient lo necesita fuera de React). */
let tokenActual: string | null = null
export function leerTokenSesion(): string | null {
  return tokenActual
}

function leerTokenStorage(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY_TOKEN)
    return v ? v.trim() : null
  } catch {
    return null
  }
}

function guardarTokenStorage(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY_TOKEN, token)
    else localStorage.removeItem(STORAGE_KEY_TOKEN)
  } catch {
    /* ignore */
  }
}

async function fetchJson<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')
  const res = await fetch(path, { ...init, headers })
  const txt = await res.text()
  let parsed: unknown = null
  try {
    parsed = txt ? JSON.parse(txt) : null
  } catch {
    parsed = null
  }
  if (!res.ok) {
    const e = parsed as ErrorResponse | null
    const msg = e?.mensaje || `HTTP ${res.status}`
    const err = new Error(msg) as Error & { status?: number; codigo?: string }
    err.status = res.status
    err.codigo = e?.codigo
    throw err
  }
  return parsed as T
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const t = leerTokenStorage()
    tokenActual = t
    return t
  })
  const [usuario, setUsuario] = useState<UsuarioAdmin | null>(null)
  const [estado, setEstado] = useState<EstadoAuth>(() => (leerTokenStorage() ? 'verificando' : 'sin-sesion'))

  const limpiarSesion = useCallback(() => {
    tokenActual = null
    setToken(null)
    setUsuario(null)
    guardarTokenStorage(null)
    setEstado('sin-sesion')
  }, [])

  // Al montar, si hay token persistido, lo validamos contra /admin/auth/me.
  useEffect(() => {
    if (!token) {
      setEstado('sin-sesion')
      return
    }
    let cancelado = false
    void (async () => {
      try {
        const r = await fetchJson<MeResponse>('/api/admin/auth/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelado) return
        setUsuario(r.usuario)
        setEstado('autenticado')
      } catch {
        if (cancelado) return
        limpiarSesion()
      }
    })()
    return () => {
      cancelado = true
    }
    // Sólo al montar o cuando cambia el token tras login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetchJson<LoginResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    tokenActual = r.token
    guardarTokenStorage(r.token)
    setUsuario(r.usuario)
    setToken(r.token)
    setEstado('autenticado')
  }, [])

  const logout = useCallback(async () => {
    const t = tokenActual
    if (t) {
      try {
        await fetchJson<{ ok: boolean }>('/api/admin/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` },
        })
      } catch {
        /* ignorar errores de logout */
      }
    }
    limpiarSesion()
  }, [limpiarSesion])

  const value = useMemo<AuthValue>(
    () => ({
      estado,
      token,
      usuario,
      login,
      logout,
      obtenerToken: () => tokenActual,
    }),
    [estado, token, usuario, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
