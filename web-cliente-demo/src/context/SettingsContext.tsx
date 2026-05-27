import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { DataSourceMode } from '../lib/settings'
import { roleFromBackend, roleLabel, rolePermissions, type RolePermissions } from '../lib/roles'
import { useAuth } from './AuthContext'
import type { AppRole } from '../types/demo'

interface SettingsValue {
  /**
   * Compatibilidad: hoy la consola siempre opera contra el backend; el
   * modo 'demo' (sólo navegador) ya no se usa. Lo dejamos para no romper
   * a los consumidores existentes.
   */
  mode: DataSourceMode
  /**
   * @deprecated Ya no se almacena ni se usa una X-API-Key local. El JWT
   * gestionado por AuthContext la reemplaza completamente. Se mantiene
   * la propiedad por compatibilidad con código legacy: devuelve string
   * vacía cuando no hay sesión, o el token JWT cuando hay sesión activa
   * (útil sólo para mostrarlo enmascarado).
   */
  apiKey: string
  role: AppRole
  roleLabel: string
  /** Nombre completo del usuario logueado (vacío si no hay sesión). */
  nombreUsuario: string
  /** Tenant del usuario logueado (vacío si no hay sesión). */
  tenant: string
  permissions: RolePermissions
  /** @deprecated mantiene la firma; ya no hay alternativa al modo API. */
  setMode: (m: DataSourceMode) => void
  /** @deprecated mantiene la firma; el frontend ya no edita la API key. */
  setApiKey: (k: string) => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { usuario, token } = useAuth()

  const setMode = useCallback((_m: DataSourceMode) => {
    /* no-op: el modo demo se eliminó al introducir login JWT */
  }, [])
  const setApiKey = useCallback((_k: string) => {
    /* no-op: el frontend ya no maneja X-API-Key directamente */
  }, [])

  const role = useMemo<AppRole>(() => roleFromBackend(usuario?.rol), [usuario])
  const roleName = useMemo(() => roleLabel(role), [role])
  const permissions = useMemo(() => rolePermissions(role), [role])

  const value = useMemo<SettingsValue>(
    () => ({
      mode: 'api',
      apiKey: token ?? '',
      role,
      roleLabel: roleName,
      nombreUsuario: usuario?.nombreCompleto ?? '',
      tenant: usuario?.tenant ?? '',
      permissions,
      setMode,
      setApiKey,
    }),
    [token, usuario, role, roleName, permissions, setMode, setApiKey],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider')
  return ctx
}
