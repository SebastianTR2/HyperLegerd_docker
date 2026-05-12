import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getApiKeyStored,
  getDataSourceMode,
  normalizeApiKey,
  setApiKeyStored,
  setDataSourceMode,
  STORAGE_KEY_API_KEY,
  type DataSourceMode,
} from '../lib/settings'
import { resolveRoleFromApiKey, roleLabel, rolePermissions, type RolePermissions } from '../lib/roles'
import type { AppRole } from '../types/demo'

interface SettingsValue {
  mode: DataSourceMode
  apiKey: string
  role: AppRole
  roleLabel: string
  permissions: RolePermissions
  setMode: (m: DataSourceMode) => void
  setApiKey: (k: string) => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataSourceMode>(() => getDataSourceMode())
  const [apiKey, setApiKeyState] = useState(() => getApiKeyStored())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_API_KEY)
      if (raw == null) return
      const cleaned = normalizeApiKey(raw)
      if (cleaned !== raw) {
        localStorage.setItem(STORAGE_KEY_API_KEY, cleaned)
        setApiKeyState(cleaned)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return
      if (e.key !== null && e.key !== STORAGE_KEY_API_KEY) return
      setApiKeyState(getApiKeyStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((m: DataSourceMode) => {
    setDataSourceMode(m)
    setModeState(m)
  }, [])

  const setApiKey = useCallback((k: string) => {
    const cleaned = normalizeApiKey(k)
    setApiKeyStored(cleaned)
    setApiKeyState(cleaned)
  }, [])

  const role = useMemo(() => resolveRoleFromApiKey(apiKey), [apiKey])
  const roleName = useMemo(() => roleLabel(role), [role])
  const permissions = useMemo(() => rolePermissions(role), [role])

  const value = useMemo(
    () => ({
      mode,
      apiKey,
      role,
      roleLabel: roleName,
      permissions,
      setMode,
      setApiKey,
    }),
    [mode, apiKey, role, roleName, permissions, setMode, setApiKey],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider')
  return ctx
}
