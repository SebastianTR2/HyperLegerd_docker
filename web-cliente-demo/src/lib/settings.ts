export type DataSourceMode = 'demo' | 'api'

const KEY_MODE = 'campuschain-data-source'
export const STORAGE_KEY_API_KEY = 'campuschain-api-key'

/** Limpia BOM, espacios invisibles y espacios externos (evita claves que no coinciden con el backend). */
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

export function getDataSourceMode(): DataSourceMode {
  try {
    const v = localStorage.getItem(KEY_MODE)
    if (v === 'demo') return 'demo'
    if (v === 'api') return 'api'
    return 'api'
  } catch {
    return 'api'
  }
}

export function setDataSourceMode(mode: DataSourceMode): void {
  try {
    localStorage.setItem(KEY_MODE, mode)
  } catch {
    /* ignore */
  }
}

export function getApiKeyStored(): string {
  try {
    return normalizeApiKey(localStorage.getItem(STORAGE_KEY_API_KEY) ?? '')
  } catch {
    return ''
  }
}

export function setApiKeyStored(key: string): void {
  try {
    const cleaned = normalizeApiKey(key)
    localStorage.setItem(STORAGE_KEY_API_KEY, cleaned)
  } catch {
    /* ignore */
  }
}
