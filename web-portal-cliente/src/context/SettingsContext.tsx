import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { resolvePortalApiKey, STORAGE_KEY_PORTAL_API_KEY } from '../lib/settings'

interface SettingsValue {
  /** Clave efectiva (entorno o respaldo en almacenamiento). No mostrar en UI de usuario. */
  apiKey: string
  /** Hay clave disponible para enviar solicitudes al servicio. */
  isServiceConfigured: boolean
  reloadAuth: () => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setKeyState] = useState(() => resolvePortalApiKey())

  const reloadAuth = useCallback(() => {
    setKeyState(resolvePortalApiKey())
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_PORTAL_API_KEY) reloadAuth()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', reloadAuth)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', reloadAuth)
    }
  }, [reloadAuth])

  const isServiceConfigured = apiKey.length > 0

  const value = useMemo(
    () => ({ apiKey, isServiceConfigured, reloadAuth }),
    [apiKey, isServiceConfigured, reloadAuth],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings requiere SettingsProvider')
  return ctx
}
