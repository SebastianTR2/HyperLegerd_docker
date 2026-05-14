import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchHistorialCliente, operacionesAVista } from '../services/apiHistorialCliente'
import type { HistorialFilaVista } from '../services/apiHistorialCliente'

const btn =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

export default function ClienteHistorialPage() {
  const { clienteId: clienteIdParam } = useParams()
  const clienteId = decodeURIComponent(clienteIdParam ?? '').trim()
  const [rows, setRows] = useState<HistorialFilaVista[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)
    try {
      const h = await fetchHistorialCliente(clienteId)
      setRows(operacionesAVista(h))
    } catch (e) {
      setError(describeApiError(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => {
    void load()
  }, [load])

  if (!clienteId) {
    return (
      <div className="p-6 text-sm text-muted">
        clienteId no válido.{' '}
        <Link className="text-accent hover:underline" to="/clientes-registrados">
          Volver al listado
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Historial en cadena</h1>
          <p className="mt-1 text-sm text-muted">
            Origen:{' '}
            <code className="rounded bg-surface px-1 font-mono text-xs">GET /clientes/historial/{clienteId}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={loading} onClick={() => void load()}>
            {loading ? 'Cargando…' : 'Refrescar'}
          </button>
          <Link
            to="/consultas"
            state={{ clienteId }}
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface/60 px-4 py-2.5 text-sm text-slate-200 hover:bg-elevated"
          >
            Ver detalle (consulta)
          </Link>
          <Link to="/clientes-registrados" className="inline-flex items-center justify-center rounded-xl border border-line px-4 py-2.5 text-sm text-muted hover:text-slate-200">
            Listado
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-danger/90">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-elevated/90 shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 text-xs uppercase text-muted backdrop-blur-sm">
            <tr>
              <th className="px-4 py-2 font-medium">txId</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Resumen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!loading && rows.length === 0 && !error ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Sin operaciones devueltas para este cliente.
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={`${r.txId}-${r.timestamp}`} className="hover:bg-surface/40">
                <td className="px-4 py-2 font-mono text-xs text-slate-300">{r.txId}</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatDemoDateTime(r.timestamp)}</td>
                <td className="px-4 py-2 text-xs">
                  {r.isDelete ? <span className="text-rose-300">Baja</span> : <span className="text-slate-300">Cambio</span>}
                </td>
                <td className="max-w-md px-4 py-2 text-slate-200">{r.resumen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
