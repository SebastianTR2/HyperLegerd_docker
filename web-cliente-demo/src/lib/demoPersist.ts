import type { PersistedDemoState } from '../types/demo'

export const DEMO_STORAGE_KEY = 'campuschain-demo-v1'

export function randomHexRef(length = 64): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function newEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

export function defaultDemoState(): PersistedDemoState {
  return {
    version: 2,
    registros: [],
    eventos: [],
    tokenOps: [],
  }
}

export function loadDemoState(): PersistedDemoState {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return defaultDemoState()
    const parsed = JSON.parse(raw) as {
      version?: number
      registros?: unknown
      eventos?: unknown
      tokenOps?: unknown
    }
    if (!Array.isArray(parsed.registros)) {
      return defaultDemoState()
    }
    if (parsed.version === 1) {
      return {
        version: 2,
        registros: [],
        eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
        tokenOps: Array.isArray(parsed.tokenOps) ? parsed.tokenOps : [],
      }
    }
    if (parsed.version !== 2) {
      return defaultDemoState()
    }
    return {
      version: 2,
      registros: parsed.registros,
      eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
      tokenOps: Array.isArray(parsed.tokenOps) ? parsed.tokenOps : [],
    }
  } catch {
    return defaultDemoState()
  }
}

export function saveDemoState(state: PersistedDemoState): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private mode */
  }
}
