import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchHistorialCliente, fetchLineaTiempoCliente, operacionesAVista } from '../services/apiHistorialCliente'
import type { HistorialFilaVista, AccionLineaTiempo } from '../services/apiHistorialCliente'

const btn =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'

interface CambioCampo {
  campo: string
  antes: string
  despues: string
}

function obtenerCambios(prev: any, curr: any): CambioCampo[] {
  if (!prev) return []
  const cambios: CambioCampo[] = []
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(curr)]))

  for (const key of keys) {
    const valPrev = String(prev[key] ?? '')
    const valCurr = String(curr[key] ?? '')
    if (valPrev !== valCurr) {
      cambios.push({
        campo: key,
        antes: valPrev || '(vacío)',
        despues: valCurr || '(vacío)'
      })
    }
  }
  return cambios
}

export default function ClienteHistorialPage() {
  const { clienteId: clienteIdParam } = useParams()
  const clienteId = decodeURIComponent(clienteIdParam ?? '').trim()
  const [rows, setRows] = useState<HistorialFilaVista[]>([])
  const [timeline, setTimeline] = useState<AccionLineaTiempo[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)
    try {
      const [h, t] = await Promise.all([
        fetchHistorialCliente(clienteId),
        fetchLineaTiempoCliente(clienteId)
      ])
      setRows(operacionesAVista(h))
      setTimeline(t.acciones)
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

      {!loading && timeline.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/30 p-5 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Auditoría de Negocio (Línea de Tiempo)</h2>
          <div className="flex flex-wrap gap-4">
            {timeline.map((acc, i) => (
              <div 
                key={`${acc.txId}-${i}`} 
                onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 shadow-sm transition-all hover:scale-105 ${
                  selectedIdx === i 
                    ? 'border-accent bg-accent/10 ring-1 ring-accent' 
                    : 'border-line/40 bg-elevated/40 hover:border-accent/40'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  acc.tipo === 'creado' ? 'bg-emerald-500/20 text-emerald-400' :
                  acc.tipo === 'baja' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-sky-500/20 text-sky-400'
                }`}>
                  {acc.tipo === 'creado' ? '★' : acc.tipo === 'baja' ? '✖' : '✎'}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">
                    {rows[i]?.cliente?.clienteId} - {rows[i]?.cliente?.nombre}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase ${
                      acc.tipo === 'creado' ? 'text-emerald-400' :
                      acc.tipo === 'baja' ? 'text-rose-400' :
                      'text-sky-400'
                    }`}>
                      {acc.etiqueta}
                    </span>
                    <span className="text-[10px] text-muted">•</span>
                    <span className="text-[10px] text-muted">{formatDemoDateTime(acc.fecha)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {rows.map((r, i) => (
              <tr 
                key={`${r.txId}-${r.timestamp}`} 
                className={`cursor-pointer transition-colors ${selectedIdx === i ? 'bg-accent/10' : 'hover:bg-surface/40'}`}
                onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              >
                <td className="px-4 py-2 font-mono text-xs text-slate-300">{r.txId.slice(0, 8)}...</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatDemoDateTime(r.timestamp)}</td>
                <td className="px-4 py-2 text-xs">
                  {r.isDelete ? <span className="text-rose-300">Baja</span> : <span className="text-slate-300">Cambio</span>}
                </td>
                <td className="max-w-md px-4 py-2 text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>{r.resumen}</span>
                    <span className="text-[10px] text-accent uppercase font-semibold">{selectedIdx === i ? 'Cerrar' : 'Ver cambios'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel de Comparación (Tipo GitHub Mejorado) */}
      {selectedIdx !== null && rows[selectedIdx] && (
        <div className="rounded-2xl border border-accent/30 bg-surface/40 p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Detalle de la transacción</h3>
              <p className="text-[10px] text-muted font-mono">{rows[selectedIdx].txId}</p>
            </div>
            <button onClick={() => setSelectedIdx(null)} className="rounded-lg bg-surface/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-elevated">Cerrar</button>
          </div>
          
          {selectedIdx === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Registro Inicial
              </div>
              <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-surface/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-500/10 text-[10px] uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Campo</th>
                      <th className="px-4 py-2 font-semibold">Valor Registrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {Object.entries(rows[selectedIdx].cliente || {}).map(([key, val]) => (
                      <tr key={key} className="group">
                        <td className="px-4 py-2.5 font-medium text-slate-400">{key}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{String(val || '(vacío)')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-line bg-surface/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface/40 text-[10px] uppercase text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Campo</th>
                      <th className="px-4 py-2 font-semibold">Estado Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {Object.entries(rows[selectedIdx].cliente || {}).map(([key, val]) => {
                      const prevVal = rows[selectedIdx - 1].cliente?.[key as keyof typeof rows[0]['cliente']]
                      const hasChanged = String(prevVal ?? '') !== String(val ?? '')
                      
                      return (
                        <tr key={key} className={hasChanged ? 'bg-accent/5' : ''}>
                          <td className={`px-4 py-2.5 font-medium ${hasChanged ? 'text-accent' : 'text-slate-500'}`}>{key}</td>
                          <td className="px-4 py-2.5">
                            {hasChanged ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300/60 line-through">{String(prevVal || '(vacío)')}</span>
                                <span className="text-muted text-[10px]">→</span>
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-medium text-emerald-400">{String(val || '(vacío)')}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">{String(val || '(vacío)')}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex items-center gap-4 text-[10px] text-muted">
             <div className="flex items-center gap-1.5">
               <div className="h-2 w-2 rounded-full bg-rose-500/50"></div>
               <span>Eliminado / Anterior</span>
             </div>
             <div className="flex items-center gap-1.5">
               <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
               <span>Agregado / Nuevo</span>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
