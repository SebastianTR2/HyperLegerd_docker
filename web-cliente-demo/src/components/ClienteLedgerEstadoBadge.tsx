import type { ClienteApi } from '../types/api'
import { clienteLedgerEstadoResumen } from '../lib/clienteLedgerEstado'

export function ClienteLedgerEstadoBadge({ c, raw = false }: { c: ClienteApi; raw?: boolean }) {
  if (raw) {
    return <span className="admin-badge-neutral">{c.estado || '—'}</span>
  }
  const s = clienteLedgerEstadoResumen(c)
  const label = s === 'baja' ? 'Dado de baja' : s === 'activo' ? 'Activo' : 'Inactivo'
  const cls =
    s === 'activo' ? 'admin-badge-success' : s === 'baja' ? 'admin-badge-danger' : 'admin-badge-neutral'
  return <span className={cls}>{label}</span>
}
