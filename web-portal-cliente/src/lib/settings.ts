/** Clave de API almacenada solo en el navegador de esta aplicación. */
export const STORAGE_KEY_PORTAL_API_KEY = 'campuschain-portal-api-key'

export function normalizeApiKey(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
  s = s.trim()
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim()
  }
  return s
}

export function getPortalApiKey(): string {
  try {
    return normalizeApiKey(localStorage.getItem(STORAGE_KEY_PORTAL_API_KEY) ?? '')
  } catch {
    return ''
  }
}

/** Orden: variable de entorno `VITE_PORTAL_API_KEY`, luego clave en localStorage (solo desarrollo / respaldo). */
export function resolvePortalApiKey(): string {
  const fromEnv = normalizeApiKey(import.meta.env.VITE_PORTAL_API_KEY ?? '')
  if (fromEnv) return fromEnv
  return getPortalApiKey()
}

export function isPortalServiceConfigured(): boolean {
  return resolvePortalApiKey().length > 0
}

export function setPortalApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_PORTAL_API_KEY, normalizeApiKey(key))
  } catch {
    /* ignore */
  }
}
