import { useCallback, useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDemoStore } from '../context/DemoStoreContext'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

const btn =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

export default function ClientesRegistradosPage() {
  const location = useLocation()
  const focusId = useMemo(() => {
    const st = location.state as { focusId?: string } | null | undefined
    return typeof st?.focusId === 'string' && st.focusId.trim() ? st.focusId.trim() : undefined
  }, [location.state])

  const {
    clientesLedger,
    clientesLedgerLoading,
    clientesLedgerError,
    clientesLedgerAccessDenied,
    refreshClientesLedger,
  } = useDemoStore()
  const rows: ClienteApi[] = clientesLedger

  const load = useCallback(async () => {
    await refreshClientesLedger()
  }, [refreshClientesLedger])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!focusId || clientesLedgerLoading) return
    const el = document.getElementById(`cliente-row-${focusId}`)
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [focusId, clientesLedgerLoading, rows.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Clientes registrados</h1>
        <p className="mt-1 text-sm text-muted">Origen: GET /clientes · mismos datos que el panel principal</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => void load()} disabled={clientesLedgerLoading}>
          {clientesLedgerLoading ? 'Cargando…' : 'Refrescar'}
        </button>
        {!clientesLedgerLoading && !clientesLedgerError ? (
          <span className="text-sm text-slate-300">{rows.length} cliente(s) en red.</span>
        ) : null}
      </div>
      {clientesLedgerAccessDenied ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
          <p>{clientesLedgerError}</p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/credenciales">
            Abrir Credenciales
          </Link>
        </div>
      ) : clientesLedgerError ? (
        <p className="text-sm text-danger/90">{clientesLedgerError}</p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-elevated/90 shadow-card">
        {!clientesLedgerLoading && rows.length === 0 && !clientesLedgerError ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No hay clientes registrados todavía.</p>
        ) : null}
        {!clientesLedgerLoading && rows.length === 0 && clientesLedgerAccessDenied ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Listado no disponible. Revise credenciales y vuelva a refrescar.</p>
        ) : null}
        {rows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 text-xs uppercase text-muted backdrop-blur-sm">
              <tr>
                <th className="px-4 py-2 font-medium">clienteId</th>
                <th className="px-4 py-2 font-medium">nombre</th>
                <th className="px-4 py-2 font-medium">documento</th>
                <th className="px-4 py-2 font-medium">estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr
                  key={r.clienteId}
                  id={`cliente-row-${r.clienteId}`}
                  className={
                    focusId === r.clienteId
                      ? 'bg-accent/10 ring-1 ring-inset ring-accent/25'
                      : undefined
                  }
                >
                  <td className="px-4 py-2 font-mono text-xs text-slate-200">{r.clienteId}</td>
                  <td className="px-4 py-2 text-slate-200">{r.nombre}</td>
                  <td className="px-4 py-2 text-muted">
                    {r.tipoDocumento} {r.numeroDocumento}
                  </td>
                  <td className="px-4 py-2">
                    <ClienteLedgerEstadoBadge c={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  )
}
