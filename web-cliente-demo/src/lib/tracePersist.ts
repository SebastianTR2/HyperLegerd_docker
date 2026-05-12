import type { TraceEntry } from '../types/demo'

const TRACE_KEY = 'campuschain-trace-v1'

export function loadTraceEntries(): TraceEntry[] {
  try {
    const raw = localStorage.getItem(TRACE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as TraceEntry[]) : []
  } catch {
    return []
  }
}

export function saveTraceEntries(list: TraceEntry[]): void {
  try {
    localStorage.setItem(TRACE_KEY, JSON.stringify(list.slice(0, 300)))
  } catch {
    /* ignore */
  }
}
