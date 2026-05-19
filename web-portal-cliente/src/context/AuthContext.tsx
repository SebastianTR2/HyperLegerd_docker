import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authStorage'
import { puedeEscribirRol, esSoloLecturaRol } from '../lib/roles'
import { loginPortal, logoutPortal, mePortal, type PortalUser } from '../services/authApi'

interface AuthValue {
  user: PortalUser | null
  loading: boolean
  isAuthenticated: boolean
  readOnly: boolean
  puedeEscribir: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setUser(null)
      return
    }
    const u = await mePortal()
    setUser(u)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!getAuthToken()) {
          setUser(null)
          return
        }
        const u = await mePortal()
        if (!cancelled) setUser(u)
      } catch {
        clearAuthToken()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshMe])

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginPortal({ username, password })
    setAuthToken(res.token)
    setUser(res.usuario)
  }, [])

  const logout = useCallback(async () => {
    await logoutPortal()
    clearAuthToken()
    setUser(null)
  }, [])

  const rol = user?.rol ?? ''
  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      readOnly: esSoloLecturaRol(rol),
      puedeEscribir: puedeEscribirRol(rol),
      login,
      logout,
      refreshMe,
    }),
    [user, loading, rol, login, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requiere AuthProvider')
  return ctx
}
