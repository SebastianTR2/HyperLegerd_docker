import type { ClienteApiCacheRow } from '../types/api'

const KEY = 'campuschain-api-clientes-cache'

export function loadApiClientesCache(): ClienteApiCacheRow[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is ClienteApiCacheRow => x && typeof (x as ClienteApiCacheRow).clienteId === 'string')
  } catch {
    return []
  }
}

export function saveApiClientesCache(list: ClienteApiCacheRow[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)))
  } catch {
    /* ignore */
  }
}

export function upsertApiClienteCache(list: ClienteApiCacheRow[], cliente: ClienteApiCacheRow): ClienteApiCacheRow[] {
  const idx = list.findIndex((c) => c.clienteId === cliente.clienteId)
  const next = idx === -1 ? [cliente, ...list] : list.map((c, i) => (i === idx ? { ...c, ...cliente } : c))
  saveApiClientesCache(next)
  return next
}
