import type { ClienteApi } from '../types/api'
import { clienteLedgerEstadoResumen } from '../lib/clienteLedgerEstado'

export function ClienteLedgerEstadoBadge({ c, raw = false }: { c: ClienteApi; raw?: boolean }) {
  if (raw) {
    return (
      <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
        {c.estado || '—'}
      </span>
    )
  }
  const s = clienteLedgerEstadoResumen(c)
  const label = s === 'baja' ? 'Dado de baja' : s === 'activo' ? 'Activo' : 'Inactivo'
  const cls =
    s === 'activo'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : s === 'baja'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : 'border-slate-500/25 bg-slate-500/10 text-slate-300'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
  )
}
